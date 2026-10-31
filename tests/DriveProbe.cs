using System;
using System.IO;
using System.Text;
using System.Net;
using System.Net.Sockets;
using System.Net.Http;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;

class DriveProbe {
 static JavaScriptSerializer json=new JavaScriptSerializer();static int checks;
 static void Check(bool ok,string name){if(!ok)throw new Exception(name);checks++;Console.WriteLine("PASS "+name);}
 static FieldInfo Field(string name){return typeof(DriveSync).GetField(name,BindingFlags.NonPublic|BindingFlags.Instance);}
 static Dictionary<string,string> Account(DriveSync sync){return (Dictionary<string,string>)Field("account").GetValue(sync);}
 static void Save(DriveSync sync){typeof(DriveSync).GetMethod("SaveAccount",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(sync,null);}
 class Network : HttpMessageHandler {
  public int calls,uploads,creates;public bool offline,invalidGrant,deleted,badLocation,failPut;public string uploaded,refreshBody,metadata;public Action duringUpload;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancel){
   calls++;if(offline)throw new HttpRequestException("offline");string url=request.RequestUri.AbsoluteUri,body=request.Content==null?"":await request.Content.ReadAsStringAsync();string result="{}";var code=HttpStatusCode.OK;
   if(url.EndsWith("/token")){refreshBody=body;if(invalidGrant){code=HttpStatusCode.BadRequest;result="{\"error\":\"invalid_grant\"}";}else result="{\"access_token\":\"test-access\",\"expires_in\":3600}";}
   else if(url.Contains("generateIds"))result="{\"ids\":[\"device-file-1\"]}";
   else if(url.Contains("uploadType=resumable")){
    Check(request.Headers.Authorization.Parameter=="test-access","Upload uses an access token header");
    if(request.Method==HttpMethod.Post){creates++;metadata=body;}
    if(deleted){deleted=false;return new HttpResponseMessage(HttpStatusCode.NotFound){Content=new StringContent("{}")};}
    var response=new HttpResponseMessage(code){Content=new StringContent("{}")};response.Headers.Location=new Uri(badLocation?"https://attacker.invalid/upload":"https://www.googleapis.com/upload/session");return response;
   }
   else if(url.EndsWith("/upload/session")){
    if(failPut){failPut=false;throw new HttpRequestException("connection dropped");}
    uploads++;uploaded=body;if(duringUpload!=null){var change=duringUpload;duringUpload=null;change();}result="{\"id\":\"device-file-1\"}";
   }
   else if(url.Contains("alt=media"))result="{\"version\":1,\"folders\":[],\"notebooks\":[]}";
   else if(url.Contains("fields=appProperties,size"))result="{\"appProperties\":{\"papernote\":\"library\"},\"size\":100}";
   else if(url.Contains("files?fields=id"))result="{\"id\":\"folder-1\"}";
   else if(url.Contains("files?")){result="{\"files\":[]}";if(url.Contains("value%3D%27folder%27"))result="{\"files\":[{\"id\":\"folder-1\"}]}";}
   return new HttpResponseMessage(code){Content=new StringContent(result)};
  }
 }
 static async Task Run(string directory){
  Directory.CreateDirectory(directory);string vault=Path.Combine(directory,"library.json");File.WriteAllText(vault,"{\"version\":1,\"notebooks\":[],\"folders\":[]}");
  Check(DriveSync.Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")=="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","PKCE matches the RFC 7636 vector");
  string auth=DriveSync.AuthUrl("test.apps.googleusercontent.com","http://127.0.0.1:1234/","state-a","verifier");Check(auth.StartsWith("https://accounts.google.com/")&&auth.Contains("code_challenge_method=S256")&&auth.Contains("access_type=offline")&&auth.Contains("drive.file")&&!auth.Contains("client_secret"),"Authorization requests only file access, offline access and PKCE");
  Check(DriveSync.CallbackCode("/?code=abc&state=correct","correct")=="abc","Loopback accepts a matching OAuth state");
  Check(DriveSync.CallbackCode("/?code=abc&state=forged","correct")==null&&DriveSync.CallbackCode("/?code=abc&state=correct&state=forged","correct")==null,"Loopback rejects forged and duplicated OAuth states");
  Check(DriveSync.CallbackCode("/other?code=abc&state=correct","correct")==null,"Loopback rejects unexpected callback paths");
  bool denied=false;try{DriveSync.CallbackCode("/?error=access_denied&state=correct","correct");}catch{denied=true;}Check(denied,"Google consent cancellation is handled");
  var network=new Network();object status=null;
  using(var sync=new DriveSync(directory,vault,value=>status=value,new HttpClient(network))){
   var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();
   try{var received=sync.ReceiveCode(listener,"real-state",CancellationToken.None);using(var socket=new TcpClient()){await socket.ConnectAsync(IPAddress.Loopback,((IPEndPoint)listener.LocalEndpoint).Port);using(var stream=socket.GetStream()){byte[] request=Encoding.ASCII.GetBytes("GET /?code=loopback-code&state=real-state HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");await stream.WriteAsync(request,0,request.Length);var buffer=new byte[4096];await stream.ReadAsync(buffer,0,buffer.Length);}}Check(await received=="loopback-code","The actual loopback listener receives a valid authorization callback");}finally{listener.Stop();}
   var account=Account(sync);account["clientId"]="test.apps.googleusercontent.com";account["secret"]="test-secret";account["refresh"]="test-refresh";account["email"]="test@example.invalid";Save(sync);
   byte[] protectedBytes=File.ReadAllBytes(Path.Combine(directory,"drive-account.bin"));Check(!Encoding.UTF8.GetString(protectedBytes).Contains("test-refresh")&&!Encoding.UTF8.GetString(protectedBytes).Contains("test-secret"),"Windows protects credentials at rest");
   sync.Status();Check(!json.Serialize(status).Contains("test-refresh")&&!json.Serialize(status).Contains("test-secret"),"Renderer receives no Google secrets or tokens");
   sync.Saved();int before=network.calls;await sync.Sync();Check(network.calls==before,"Autosync debounces recent local saves");
   network.offline=true;await sync.Sync(true);Check(File.Exists(vault)&&Account(sync).ContainsKey("refresh")&&!Account(sync).ContainsKey("hash"),"Offline upload keeps the vault and pending data");Check(json.Serialize(status).Contains("khi có mạng"),"Offline status explains automatic retry");
   network.offline=false;await sync.Sync(true);Check(network.uploads==1&&network.uploaded==File.ReadAllText(vault),"Retry uploads the exact locally saved snapshot");
   Check(network.refreshBody.Contains("refresh_token=test-refresh")&&network.refreshBody.Contains("client_secret=test-secret"),"Reconnect uses a refresh token without reopening login");
   Check(network.metadata.Contains("device-file-1")&&network.metadata.Contains("library")&&network.metadata.Contains("parents"),"A device owns its generated Drive file ID and metadata");
   string encryptedFile=Path.Combine(directory,"drive-account.bin");using(var reopened=new DriveSync(directory,vault,value=>{},new HttpClient(new Network()))){Check(Account(reopened)["refresh"]=="test-refresh"&&Account(reopened)["file"]=="device-file-1","Restart recovers credentials and the existing device snapshot");}
   Field("changed").SetValue(sync,DateTime.UtcNow.AddMinutes(-1));before=network.calls;await sync.Sync();Check(network.calls==before,"Unchanged notes are not uploaded repeatedly");
   network.duringUpload=()=>{File.WriteAllText(vault,"{\"version\":1,\"notebooks\":[],\"folders\":[],\"new\":true}");sync.Saved();};await sync.Sync(true);Check(json.Serialize(status).Contains("thay đổi mới"),"Edits made during an upload remain pending");
   Field("changed").SetValue(sync,DateTime.UtcNow.AddMinutes(-1));await sync.Sync();Check(network.uploaded==File.ReadAllText(vault),"The next upload includes edits made during the previous upload");
   Check(network.creates==1,"A device updates its snapshot instead of duplicating files");
   network.deleted=true;await sync.Sync(true);Check(!Account(sync).ContainsKey("file"),"A removed Drive file is detected without touching local notes");
   Field("changed").SetValue(sync,DateTime.UtcNow.AddMinutes(-1));await sync.Sync();Check(Account(sync).ContainsKey("file")&&Account(sync)["created"]=="yes","The next automatic retry recreates a removed Drive snapshot");
   network.badLocation=true;before=network.uploads;await sync.Sync(true);Check(network.uploads==before&&json.Serialize(status).Contains("không hợp lệ"),"Upload tokens are never sent to an untrusted session host");network.badLocation=false;
   Check((await sync.List()).Length==0,"Cloud restore listing handles an empty Drive");
   Check((await sync.Download("device-file-1")).Contains("notebooks"),"Cloud restore checks file ownership metadata before reading content");
   bool bad=false;try{await sync.Download("../other?alt=media");}catch{bad=true;}Check(bad,"Cloud file identifiers cannot alter request URLs");
   Field("access").SetValue(sync,null);network.invalidGrant=true;await sync.Sync(true);Check(json.Serialize(status).Contains("\"needsLogin\":true")&&File.Exists(vault),"Revoked Google access asks for login while preserving local notes");
   network.invalidGrant=false;await sync.Disconnect();Check(!File.Exists(encryptedFile)&&Account(sync).Count==0&&File.Exists(vault),"Disconnect removes local credentials and retains notebooks");
   before=network.calls;await sync.Sync(true);Check(network.calls==before,"Disconnected accounts never upload notes");
  }
  // A failed first upload must reuse its preallocated ID after restarting.
  string retry=Path.Combine(directory,"retry");Directory.CreateDirectory(retry);var interrupted=new Network(){failPut=true};
  using(var sync=new DriveSync(retry,vault,value=>{},new HttpClient(interrupted))){var a=Account(sync);a["refresh"]="test-refresh";a["clientId"]="test.apps.googleusercontent.com";a["secret"]="test-secret";await sync.Sync(true);Check(a["created"]=="no"&&a["file"]=="device-file-1"&&!a.ContainsKey("hash"),"Interrupted first upload retains its allocated ID without marking success");await sync.Sync(true);Check(a["created"]=="yes"&&interrupted.uploads==1,"An interrupted first upload retries successfully");}
  Console.WriteLine("Drive checks passed: "+checks);
 }
 static int Main(string[] args){try{Run(Path.GetFullPath(args[0])).GetAwaiter().GetResult();return 0;}catch(Exception error){Console.WriteLine(error);return 1;}}
}
