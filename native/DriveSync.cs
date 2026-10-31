using System;
using System.IO;
using System.Text;
using System.Net;
using System.Net.Sockets;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web;
using System.Web.Script.Serialization;
using System.Diagnostics;

// Each device owns one snapshot; restoring another device always imports a copy.
class DriveSync : IDisposable {
 const string Api="https://www.googleapis.com/drive/v3/", Scope="https://www.googleapis.com/auth/drive.file";
 readonly string profile,vault,device; readonly Action<object> post; readonly HttpClient http;
 readonly SemaphoreSlim gate=new SemaphoreSlim(1,1);
 readonly JavaScriptSerializer json=new JavaScriptSerializer(){MaxJsonLength=536870912,RecursionLimit=500};
 Dictionary<string,string> account=new Dictionary<string,string>();
 string access;DateTime expires=DateTime.MinValue;bool busy,needsLogin;string message="Chưa kết nối Google Drive";
 DateTime changed=DateTime.MinValue;CancellationTokenSource loginCancel;
 public DriveSync(string directory,string vaultFile,Action<object> notify,HttpClient client=null){
  profile=directory;vault=vaultFile;post=notify;http=client??new HttpClient(new HttpClientHandler(){AllowAutoRedirect=false});http.Timeout=TimeSpan.FromMinutes(3);http.MaxResponseContentBufferSize=536870912;
  string devicePath=Path.Combine(profile,"drive-device.txt");if(!File.Exists(devicePath))File.WriteAllText(devicePath,Guid.NewGuid().ToString("N"));device=File.ReadAllText(devicePath).Trim();
  try{string path=Path.Combine(profile,"drive-account.bin");if(File.Exists(path))account=json.Deserialize<Dictionary<string,string>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path),null,DataProtectionScope.CurrentUser)));}
  catch{message="Không đọc được kết nối cũ. Hãy đăng nhập Google lại.";}
  if(Connected)message="Đã kết nối Google Drive";
 }
 string Get(string key){string value;return account.TryGetValue(key,out value)?value:"";}
 bool Connected{get{return Get("refresh")!=""&&!needsLogin;}}
 public void Status(){post(new{type="drive-status",connected=Connected,busy=busy,authenticating=loginCancel!=null,needsLogin=needsLogin,email=Get("email"),clientId=Get("clientId"),lastSync=Get("lastSync"),message=message});}
 void SaveAccount(){string path=Path.Combine(profile,"drive-account.bin"),temp=path+".tmp";File.WriteAllBytes(temp,ProtectedData.Protect(Encoding.UTF8.GetBytes(json.Serialize(account)),null,DataProtectionScope.CurrentUser));if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);}
 public void Saved(){changed=DateTime.UtcNow;if(Connected&&!busy){message="Đã lưu trên máy · Đang chờ tải lên Drive";Status();}}
 static string RandomKey(){byte[] bytes=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);return Base64Url(bytes);}
 static string Base64Url(byte[] data){return Convert.ToBase64String(data).TrimEnd('=').Replace('+','-').Replace('/','_');}
 internal static string Challenge(string verifier){using(var sha=SHA256.Create())return Base64Url(sha.ComputeHash(Encoding.ASCII.GetBytes(verifier)));}
 static string Enc(string s){return Uri.EscapeDataString(s);}
 internal static string AuthUrl(string clientId,string redirect,string state,string verifier){return "https://accounts.google.com/o/oauth2/v2/auth?client_id="+Enc(clientId)+"&redirect_uri="+Enc(redirect)+"&response_type=code&scope="+Enc(Scope)+"&access_type=offline&prompt=consent%20select_account&state="+Enc(state)+"&code_challenge="+Challenge(verifier)+"&code_challenge_method=S256";}
 internal static string CallbackCode(string target,string state){
  if(!target.StartsWith("/?",StringComparison.Ordinal))return null;
  var q=HttpUtility.ParseQueryString(target.Substring(2));if(q.GetValues("state")==null||q.GetValues("state").Length!=1||q["state"]!=state)return null;
  if(q["error"]!=null)throw new Exception("Bạn đã hủy đăng nhập Google.");
  return q.GetValues("code")!=null&&q.GetValues("code").Length==1?q["code"]:null;
 }
 internal async Task<string> ReceiveCode(TcpListener listener,string state,CancellationToken cancel){
  while(true){
   var accept=listener.AcceptTcpClientAsync();if(await Task.WhenAny(accept,Task.Delay(Timeout.Infinite,cancel))!=accept)throw new OperationCanceledException();
   using(var socket=await accept)using(var stream=socket.GetStream()){
    var bytes=new List<byte>();byte[] one=new byte[1];using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancel)){timeout.CancelAfter(5000);
     while(bytes.Count<8192){int count=await stream.ReadAsync(one,0,1,timeout.Token);if(count==0)break;bytes.Add(one[0]);int n=bytes.Count;if(n>=4&&bytes[n-4]==13&&bytes[n-3]==10&&bytes[n-2]==13&&bytes[n-1]==10)break;}
    }
    string first=Encoding.ASCII.GetString(bytes.ToArray()).Split('\r')[0];string[] parts=first.Split(' ');string code=null;Exception denied=null;
    try{if(parts.Length==3&&parts[0]=="GET")code=CallbackCode(parts[1],state);}catch(Exception e){denied=e;}
    bool valid=code!=null||denied!=null;byte[] body=Encoding.UTF8.GetBytes(valid?"<html><meta charset='utf-8'><title>PaperNote</title>Bạn có thể đóng thẻ này và quay lại PaperNote.</html>":"Invalid callback");
    byte[] head=Encoding.ASCII.GetBytes("HTTP/1.1 "+(valid?"200 OK":"400 Bad Request")+"\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: "+body.Length+"\r\n\r\n");await stream.WriteAsync(head,0,head.Length);await stream.WriteAsync(body,0,body.Length);
    if(denied!=null)throw denied;if(code!=null)return code;
   }
  }
 }
 public void CancelLogin(){if(loginCancel!=null)loginCancel.Cancel();}
 public async Task Connect(string clientId,string secret){
  if(busy)throw new Exception("Hãy chờ thao tác Drive hiện tại hoàn tất.");
  if(!System.Text.RegularExpressions.Regex.IsMatch(clientId??"",@"^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$")||string.IsNullOrWhiteSpace(secret)||secret.Length>1000)throw new Exception("Nhập Client ID và Client secret của OAuth loại Desktop app.");
  await gate.WaitAsync();busy=true;message="Đang chờ bạn đăng nhập trong trình duyệt…";
  var listener=new TcpListener(IPAddress.Loopback,0);loginCancel=new CancellationTokenSource(TimeSpan.FromMinutes(3));Status();
  try{
   listener.Start();string redirect="http://127.0.0.1:"+((IPEndPoint)listener.LocalEndpoint).Port+"/",state=RandomKey(),verifier=RandomKey();
   Process.Start(new ProcessStartInfo(AuthUrl(clientId,redirect,state,verifier)){UseShellExecute=true});
   string code=await ReceiveCode(listener,state,loginCancel.Token);
   var tokens=await Token(new Dictionary<string,string>{{"client_id",clientId},{"client_secret",secret},{"code",code},{"code_verifier",verifier},{"redirect_uri",redirect},{"grant_type","authorization_code"}});
   if(!tokens.ContainsKey("refresh_token"))throw new Exception("Google chưa cấp quyền tự đồng bộ. Hãy kết nối lại và chấp nhận quyền Drive.");
   // Commit the new account only after Google confirms its identity.
   string oldAccess=access;DateTime oldExpires=expires;access=(string)tokens["access_token"];expires=DateTime.UtcNow.AddSeconds(Convert.ToDouble(tokens["expires_in"])-60);
   Dictionary<string,object> about;
   try{about=Parse(await Request("GET",Api+"about?fields=user(emailAddress)"));}catch{access=oldAccess;expires=oldExpires;throw;}
   var next=new Dictionary<string,string>{{"clientId",clientId},{"secret",secret},{"refresh",(string)tokens["refresh_token"]},{"email",(string)((Dictionary<string,object>)about["user"])["emailAddress"]}};
   var previous=account;account=next;try{SaveAccount();}catch{account=previous;access=oldAccess;expires=oldExpires;throw;}
   needsLogin=false;changed=DateTime.MinValue;message="Đã kết nối. Đang chờ tải thư viện lên Drive.";
  }finally{listener.Stop();loginCancel.Dispose();loginCancel=null;busy=false;gate.Release();Status();}
 }
 Dictionary<string,object> Parse(string s){return (Dictionary<string,object>)json.DeserializeObject(s);}
 async Task<Dictionary<string,object>> Token(Dictionary<string,string> form){
  using(var content=new FormUrlEncodedContent(form))using(var response=await http.PostAsync("https://oauth2.googleapis.com/token",content)){string data=await response.Content.ReadAsStringAsync();if(!response.IsSuccessStatusCode){if(data.Contains("invalid_grant")&&form["grant_type"]=="refresh_token")needsLogin=true;throw new Exception(needsLogin?"Quyền Google đã hết hạn. Hãy đăng nhập lại.":"Google chưa chấp nhận kết nối. Kiểm tra Client ID, Client secret và cấu hình OAuth.");}return Parse(data);}
 }
 async Task EnsureAccess(){
  if(access!=null&&DateTime.UtcNow<expires)return;
  var tokens=await Token(new Dictionary<string,string>{{"client_id",Get("clientId")},{"client_secret",Get("secret")},{"refresh_token",Get("refresh")},{"grant_type","refresh_token"}});
  access=(string)tokens["access_token"];expires=DateTime.UtcNow.AddSeconds(Convert.ToDouble(tokens["expires_in"])-60);
 }
 async Task<string> Request(string method,string url,HttpContent content=null){
  using(var request=new HttpRequestMessage(new HttpMethod(method),url)){request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",access);request.Content=content;
   using(var response=await http.SendAsync(request)){
    if(response.StatusCode==HttpStatusCode.Unauthorized){access=null;expires=DateTime.MinValue;throw new Exception("Kết nối Google cần thử lại hoặc đăng nhập lại.");}
    if(!response.IsSuccessStatusCode)throw new Exception("Google Drive trả lỗi "+(int)response.StatusCode+". Kiểm tra mạng, dung lượng Drive và quyền ứng dụng.");
    return await response.Content.ReadAsStringAsync();
   }
  }
 }
 async Task<object[]> Files(string query){
  var items=new List<object>();string page="";
  do{var data=Parse(await Request("GET",Api+"files?pageSize=100&fields=nextPageToken,files(id,name,modifiedTime,appProperties)&q="+Enc(query)+"&pageToken="+Enc(page)));items.AddRange((object[])data["files"]);page=data.ContainsKey("nextPageToken")?(string)data["nextPageToken"]:"";}while(page!="");return items.ToArray();
 }
 static string FileId(string value){if(!System.Text.RegularExpressions.Regex.IsMatch(value??"",@"^[A-Za-z0-9_-]{1,200}$"))throw new Exception("Mã tệp Drive không hợp lệ.");return value;}
 static string Hash(string value){using(var sha=SHA256.Create())return Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));}
 public async Task Sync(bool force=false){
  if(!Connected||busy||!File.Exists(vault)||!force&&(DateTime.UtcNow-changed).TotalSeconds<5)return;
  if(!await gate.WaitAsync(0))return;busy=true;
  try{
   string data=File.ReadAllText(vault),hash=Hash(data);if(Encoding.UTF8.GetByteCount(data)>536870912)throw new Exception("Thư viện vượt giới hạn đồng bộ 512 MB. Hãy sao lưu từng sổ.");DateTime snapshotTime=changed;if(!force&&hash==Get("hash")){message="Đã tải lên Google Drive";return;}
   message="Đang tải thư viện lên Google Drive…";Status();await EnsureAccess();
   string folder=Get("folder"),file=Get("file");
   if(folder==""){
    var found=await Files("trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='papernote' and value='folder' }");
    folder=found.Length>0?(string)((Dictionary<string,object>)found[0])["id"]:(string)Parse(await Request("POST",Api+"files?fields=id",new StringContent(json.Serialize(new{name="PaperNote",mimeType="application/vnd.google-apps.folder",appProperties=new{papernote="folder"}}),Encoding.UTF8,"application/json")))["id"];
   }
   if(file==""){
    var found=await Files("trashed = false and appProperties has { key='papernote' and value='library' } and appProperties has { key='device' and value='"+device+"' }");
    if(found.Length>0)file=(string)((Dictionary<string,object>)found[0])["id"];
    else{
     var ids=Parse(await Request("GET",Api+"files/generateIds?count=1&space=drive&type=files"));file=(string)((object[])ids["ids"])[0];
     // Persist the allocated ID before upload, so a timeout cannot create duplicate backups.
     account["file"]=file;account["created"]="no";
    }
    account["folder"]=folder;account["file"]=file;SaveAccount();
   }
   bool creating=Get("created")=="no";
   var metadata=creating?new Dictionary<string,object>{{"id",file},{"name","PaperNote-"+Environment.MachineName+"-"+device.Substring(0,8)+".papernote"},{"parents",new[]{folder}},{"appProperties",new{papernote="library",device=device}}}:new Dictionary<string,object>();
   byte[] bytes=Encoding.UTF8.GetBytes(data);string url="https://www.googleapis.com/upload/drive/v3/files"+(creating?"":"/"+FileId(file))+"?uploadType=resumable&fields=id";
   string location;
   using(var request=new HttpRequestMessage(creating?HttpMethod.Post:new HttpMethod("PATCH"),url)){
    request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",access);request.Headers.TryAddWithoutValidation("X-Upload-Content-Type","application/json");request.Headers.TryAddWithoutValidation("X-Upload-Content-Length",bytes.Length.ToString());request.Content=new StringContent(json.Serialize(metadata),Encoding.UTF8,"application/json");
    using(var response=await http.SendAsync(request)){
     if(response.StatusCode==HttpStatusCode.Conflict&&creating){account["created"]="yes";SaveAccount();throw new Exception("Bản sao đã tồn tại. PaperNote sẽ thử cập nhật lại.");}
     if(response.StatusCode==HttpStatusCode.NotFound){account.Remove("file");account.Remove("folder");account.Remove("created");account.Remove("hash");SaveAccount();throw new Exception("Bản sao Drive đã bị xóa. PaperNote sẽ tạo lại.");}
     if(!response.IsSuccessStatusCode||response.Headers.Location==null)throw new Exception("Chưa mở được lượt tải lên Google Drive.");location=response.Headers.Location.AbsoluteUri;
    }
   }
   Uri destination=new Uri(location);if(destination.Scheme!="https"||(destination.Host!="www.googleapis.com"&&destination.Host!="content.googleapis.com"))throw new Exception("Địa chỉ tải lên Drive không hợp lệ.");
   using(var body=new ByteArrayContent(bytes)){body.Headers.ContentType=new MediaTypeHeaderValue("application/json");body.Headers.ContentRange=new ContentRangeHeaderValue(0,bytes.Length-1,bytes.Length);await Request("PUT",location,body);}
   account["created"]="yes";account["hash"]=hash;account["lastSync"]=DateTime.UtcNow.ToString("o");SaveAccount();message=changed==snapshotTime?"Đã tải lên Google Drive":"Đã tải một bản · Có thay đổi mới đang chờ tải";
  }catch(HttpRequestException){message="Chưa kết nối được Drive. Sổ vẫn lưu trên máy; sẽ tự thử lại khi có mạng.";}
  catch(TaskCanceledException){message="Tải lên chưa hoàn tất. Sổ vẫn lưu trên máy; sẽ tự thử lại.";}
  catch(Exception e){message=e.Message;}
  finally{busy=false;gate.Release();Status();}
 }
 public async Task<object[]> List(){await gate.WaitAsync();busy=true;Status();try{if(!Connected)throw new Exception("Hãy kết nối Google Drive trước.");await EnsureAccess();return await Files("trashed = false and appProperties has { key='papernote' and value='library' }");}finally{busy=false;gate.Release();Status();}}
 public async Task<string> Download(string id){
  FileId(id);await gate.WaitAsync();busy=true;Status();try{if(!Connected)throw new Exception("Hãy kết nối Google Drive trước.");await EnsureAccess();var info=Parse(await Request("GET",Api+"files/"+id+"?fields=appProperties,size"));
   if(!info.ContainsKey("appProperties")||!((Dictionary<string,object>)info["appProperties"]).ContainsKey("papernote")||(string)((Dictionary<string,object>)info["appProperties"])["papernote"]!="library"||!info.ContainsKey("size")||Convert.ToInt64(info["size"])>536870912)throw new Exception("Bản sao không hợp lệ hoặc lớn hơn 512 MB.");
   return await Request("GET",Api+"files/"+id+"?alt=media");
  }finally{busy=false;gate.Release();Status();}
 }
 public async Task Disconnect(){CancelLogin();await gate.WaitAsync();try{string refresh=Get("refresh"),path=Path.Combine(profile,"drive-account.bin");if(File.Exists(path))File.Delete(path);account.Clear();access=null;needsLogin=false;message="Đã ngắt kết nối. Sổ trên máy và bản sao Drive vẫn được giữ.";Status();
   if(refresh!="")try{using(var timeout=new CancellationTokenSource(5000))using(var content=new FormUrlEncodedContent(new Dictionary<string,string>{{"token",refresh}}))using(var response=await http.PostAsync("https://oauth2.googleapis.com/revoke",content,timeout.Token)){if(!response.IsSuccessStatusCode)throw new HttpRequestException();}}catch{message="Đã ngắt trên máy. Bạn có thể thu hồi quyền còn lại trong Tài khoản Google.";Status();}
  }finally{gate.Release();}}
 public void Dispose(){CancelLogin();http.Dispose();}
}
