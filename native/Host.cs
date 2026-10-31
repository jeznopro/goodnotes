using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

class PaperNote : Form {
 WebView2 view; string profile, vaultPath, verifyPath; bool closing=false, allowClose=false; System.Windows.Forms.Timer flushTimer,driveTimer; DriveSync drive; MathWindow math;
 JavaScriptSerializer json=new JavaScriptSerializer(){MaxJsonLength=536870912,RecursionLimit=500};
 static string[] arguments;
 static string Arg(string name){int index=Array.IndexOf(arguments,name);return index>=0&&index+1<arguments.Length?arguments[index+1]:null;}
 [STAThread] static void Main(string[] args){
  arguments=args;Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  string custom=Arg("--profile"); bool first;using(var mutex=new Mutex(true,"Local\\PaperNote_"+(custom==null?"main":custom.GetHashCode().ToString()),out first)){
   if(!first){MessageBox.Show("PaperNote đang chạy. Hãy mở cửa sổ từ thanh tác vụ.","PaperNote");return;}
   try{Application.Run(new PaperNote());}catch(Exception e){MessageBox.Show(e.Message,"PaperNote");Environment.ExitCode=1;}
  }
 }
 PaperNote(){
  profile=Arg("--profile")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"PaperNote","Data");
  Directory.CreateDirectory(profile);vaultPath=Path.Combine(profile,"library.json");verifyPath=Arg("--verify-report");
  Text="PaperNote";Width=1380;Height=930;MinimumSize=new Size(760,560);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(246,248,251);
  string icon=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"PaperNote.ico");if(File.Exists(icon))Icon=new Icon(icon);
  view=new WebView2(){Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};Controls.Add(view);
  Shown+=async delegate{await Initialize();};FormClosing+=OnClosing;
 }
 async Task Initialize(){
  try{
   string web=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"web");if(!File.Exists(Path.Combine(web,"index.html")))throw new Exception("Thiếu thư mục web. Hãy cài đặt lại PaperNote.");
   var options=new CoreWebView2EnvironmentOptions();
   string debug=Arg("--debug-port");if(debug!=null)options.AdditionalBrowserArguments="--remote-debugging-port="+int.Parse(debug);
   var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(profile,"WebView2"),options);
   await view.EnsureCoreWebView2Async(environment);
   view.CoreWebView2.SetVirtualHostNameToFolderMapping("papernote.local",web,CoreWebView2HostResourceAccessKind.DenyCors);
   view.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
   view.CoreWebView2.Settings.IsStatusBarEnabled=false;
   view.CoreWebView2.Settings.AreDevToolsEnabled=debug!=null;
   view.CoreWebView2.Settings.IsZoomControlEnabled=false;
   view.CoreWebView2.Settings.IsBuiltInErrorPageEnabled=false;
   view.CoreWebView2.NavigationStarting+=(s,e)=>{if(!e.Uri.StartsWith("https://papernote.local/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};
   view.CoreWebView2.NewWindowRequested+=(s,e)=>e.Handled=true;
   view.CoreWebView2.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
   view.CoreWebView2.WebMessageReceived+=OnMessage;
   drive=new DriveSync(profile,vaultPath,Post);
   driveTimer=new System.Windows.Forms.Timer(){Interval=30000};driveTimer.Tick+=async delegate{await drive.Sync();};driveTimer.Start();
   FormClosed+=delegate{driveTimer.Stop();drive.Dispose();};
   view.CoreWebView2.ProcessFailed+=(s,e)=>{MessageBox.Show("Cửa sổ ghi chú đã dừng. Hãy mở lại PaperNote. Dữ liệu đã lưu vẫn được giữ nguyên.","PaperNote");};
   view.Source=new Uri("https://papernote.local/index.html");
   if(verifyPath!=null)await Verify();
  }catch(WebView2RuntimeNotFoundException){MessageBox.Show("Máy cần Microsoft Edge WebView2 Runtime để mở PaperNote. Tải từ https://developer.microsoft.com/microsoft-edge/webview2/", "PaperNote");Environment.ExitCode=1;allowClose=true;Close();}
  catch(Exception e){if(verifyPath!=null)File.WriteAllText(verifyPath,json.Serialize(new {ok=false,error=e.ToString()}));else MessageBox.Show(e.Message,"Không mở được PaperNote");Environment.ExitCode=1;allowClose=true;Close();}
 }
 void Post(object data){if(!IsDisposed&&!Disposing&&view.CoreWebView2!=null)view.CoreWebView2.PostWebMessageAsJson(json.Serialize(data));}
 void WriteVault(string data){
  // Validate before atomically replacing the recovery copy. Keep the previous revision.
  var parsed=json.DeserializeObject(data) as System.Collections.Generic.Dictionary<string,object>;
  if(parsed==null||!parsed.ContainsKey("version")||!parsed.ContainsKey("notebooks"))throw new Exception("Dữ liệu lưu không hợp lệ.");
  string before=vaultPath+".before-2";if(File.Exists(vaultPath)&&!File.Exists(before)){System.Collections.Generic.Dictionary<string,object> old=null;try{old=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(vaultPath));}catch(ArgumentException){}catch(InvalidOperationException){}if(old!=null&&!old.ContainsKey("release"))File.Copy(vaultPath,before);}
  string temp=vaultPath+".tmp";File.WriteAllText(temp,data,new UTF8Encoding(false));
  if(File.Exists(vaultPath))File.Replace(temp,vaultPath,vaultPath+".previous");else File.Move(temp,vaultPath);
 }
 async void OnMessage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
  if(!e.Source.StartsWith("https://papernote.local/",StringComparison.OrdinalIgnoreCase))return;
  string request=null;
  try{
   var m=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(e.WebMessageAsJson);string type=(string)m["type"];if(m.ContainsKey("request"))request=(string)m["request"];
   if(type=="ready"){
    string data=null;if(File.Exists(vaultPath)){
     try{data=File.ReadAllText(vaultPath);json.DeserializeObject(data);}catch{string previous=vaultPath+".previous";if(File.Exists(previous)){data=File.ReadAllText(previous);json.DeserializeObject(data);}else throw;}
    }
    Post(new {type="vault",data=data});
   }else if(type=="persist"){WriteVault((string)m["data"]);Post(new{type="persisted",request=request});drive.Saved();}
   else if(type.StartsWith("drive-",StringComparison.Ordinal)){
    try{
     object result=null;
     if(type=="drive-status")drive.Status();
     else if(type=="drive-connect"){await drive.Connect((string)m["clientId"],(string)m["secret"]);await drive.Sync(true);}
     else if(type=="drive-sync")await drive.Sync(true);
     else if(type=="drive-disconnect")await drive.Disconnect();
     else if(type=="drive-cancel")drive.CancelLogin();
     else if(type=="drive-list")result=await drive.List();
     else if(type=="drive-download")result=await drive.Download((string)m["id"]);
     else throw new Exception("Thao tác Drive không hợp lệ.");
     if(request!=null)Post(new{type="drive-result",request=request,data=result});
    }catch(Exception error){drive.Status();Post(new{type="drive-error",request=request,message=error is OperationCanceledException?"Đăng nhập đã hủy hoặc hết thời gian chờ.":error is System.Net.Http.HttpRequestException?"Không kết nối được Google. Kiểm tra mạng rồi thử lại.":error.Message});}
   }
   else if(type=="math-open"){
    try{
     if(math!=null&&!math.IsDisposed)throw new Exception("Hãy đóng cửa sổ GeoGebra hiện tại trước.");
     math=new MathWindow(view.CoreWebView2.Environment,Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"web"),request,(string)m["app"],(string)m["ggb"],Post,view.CoreWebView2.Settings.AreDevToolsEnabled);
     string mathRequest=request;
     // WebView2 forbids a nested modal message loop inside its message callback.
     BeginInvoke(new Action(()=>{try{math.ShowDialog(this);}catch(Exception error){Post(new{type="math-error",request=mathRequest,message=error.Message});}finally{math.Dispose();math=null;Post(new{type="math-closed",request=mathRequest});}}));
    }catch(Exception error){Post(new{type="math-error",request=request,message=error.Message});}
   }
   else if(type=="math-accepted"){if(math!=null&&math.Request==request)math.Accept();}
   else if(type=="math-rejected"){if(math!=null&&math.Request==request)math.Reject((string)m["message"]);}
   else if(type=="download"){
    string name=Path.GetFileName((string)m["name"]);string ext=Path.GetExtension(name).ToLowerInvariant();if(ext!=".pdf"&&ext!=".papernote"&&ext!=".png")throw new Exception("Loại tệp không được hỗ trợ.");
    using(var dialog=new SaveFileDialog()){dialog.FileName=name;dialog.Filter=ext==".pdf"?"PDF (*.pdf)|*.pdf":ext==".png"?"PNG (*.png)|*.png":"PaperNote (*.papernote)|*.papernote";dialog.DefaultExt=ext.TrimStart('.');dialog.AddExtension=true;
     if(dialog.ShowDialog(this)==DialogResult.OK){File.WriteAllBytes(dialog.FileName,Convert.FromBase64String((string)m["data"]));Post(new{type="saved",name=Path.GetFileName(dialog.FileName),cancelled=false});}
     else Post(new{type="saved",name=name,cancelled=true});
    }
   }else if(type=="open-url"){Uri target;if(Uri.TryCreate((string)m["url"],UriKind.Absolute,out target)&&(target.Scheme=="http"||target.Scheme=="https"))Process.Start(new ProcessStartInfo(target.AbsoluteUri){UseShellExecute=true});}
   else if(type=="flushed"){if(flushTimer!=null)flushTimer.Stop();allowClose=true;Close();}
   else if(type=="flush-failed"){if(flushTimer!=null)flushTimer.Stop();closing=false;MessageBox.Show("Chưa lưu được thay đổi. Hãy sao lưu thư viện trước khi đóng.","PaperNote");}
  }catch(Exception error){Post(new{type=request==null?"error":"persist-error",request=request,message="Không lưu được dữ liệu trên đĩa: "+error.Message});}
 }
 void OnClosing(object sender,FormClosingEventArgs e){
  if(allowClose||view.CoreWebView2==null)return;e.Cancel=true;if(closing)return;closing=true;
  try{Post(new{type="flush"});}catch{allowClose=true;Close();return;}
  flushTimer=new System.Windows.Forms.Timer(){Interval=10000};flushTimer.Tick+=delegate{flushTimer.Stop();closing=false;if(MessageBox.Show("Lưu dữ liệu đang chậm. Bạn vẫn muốn đóng cửa sổ? Các thay đổi chưa lưu có thể bị mất.","PaperNote",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)==DialogResult.Yes){allowClose=true;Close();}};flushTimer.Start();
 }
 async Task Verify(){
  for(int i=0;i<120;i++){await Task.Delay(250);string ready=await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.__papernoteReady)");if(ready=="true"){
   string state=await view.CoreWebView2.ExecuteScriptAsync("JSON.stringify({title:document.title,books:document.querySelectorAll('[data-open]').length,text:document.body.innerText.slice(0,250)})");
   await view.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-open]').click()");await Task.Delay(1200);
   string editor=await view.CoreWebView2.ExecuteScriptAsync("JSON.stringify({canvas:!!document.querySelector('#paper'),tools:document.querySelectorAll('[data-tool]').length})");
   using(var stream=File.Create(Path.ChangeExtension(verifyPath,"png")))await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
   File.WriteAllText(verifyPath,json.Serialize(new{ok=true,library=state,editor=editor,runtime=view.CoreWebView2.Environment.BrowserVersionString}));
   allowClose=true;Close();return;
  }}throw new Exception("Hết thời gian kiểm tra giao diện Windows.");
 }
}
