using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Linq;
using System.Drawing;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Third-party math code runs on a separate origin with no access to the notebook bridge.
class MathWindow : Form {
 readonly WebView2 view;readonly CoreWebView2Environment environment;readonly string web,app,ggb;readonly bool debug;
 readonly Action<object> result;readonly JavaScriptSerializer json=new JavaScriptSerializer(){MaxJsonLength=40000000};
 bool dirty,accepted;string runtime="";
 public readonly string Request;
 public MathWindow(CoreWebView2Environment env,string webDirectory,string request,string mode,string construction,Action<object> onResult,bool devTools){
  Validate(mode,construction);environment=env;web=webDirectory;Request=request;app=mode;ggb=construction;result=onResult;debug=devTools;
  Text="GeoGebra · PaperNote";Width=1180;Height=850;MinimumSize=new Size(760,580);StartPosition=FormStartPosition.CenterParent;BackColor=Color.White;
  view=new WebView2(){Dock=DockStyle.Fill,DefaultBackgroundColor=Color.White};Controls.Add(view);Shown+=async delegate{await Initialize();};
  FormClosing+=(s,e)=>{if(!accepted&&dirty&&MessageBox.Show(this,"Hình chưa được chèn vào ghi chú. Đóng và bỏ thay đổi?","GeoGebra",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)e.Cancel=true;};
 }
 internal static void Validate(string mode,string construction){if(mode!="graphing"&&mode!="geometry"&&mode!="3d"&&mode!="classic")throw new Exception("Loại GeoGebra không hợp lệ.");if(construction==null||construction.Length>14000000||construction!=""&&!Regex.IsMatch(construction,@"^UEs[A-Za-z0-9+/]*={0,2}$"))throw new Exception("Dữ liệu GeoGebra không hợp lệ hoặc quá lớn.");}
 async Task Initialize(){
  try{
   await view.EnsureCoreWebView2Async(environment);
   var core=view.CoreWebView2;core.SetVirtualHostNameToFolderMapping("papernote-math.local",web,CoreWebView2HostResourceAccessKind.DenyCors);
   string installed=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"GeoGebra_6");
   if(Directory.Exists(installed))foreach(string folder in Directory.GetDirectories(installed,"app-*").OrderByDescending(p=>{Version v;return Version.TryParse(Path.GetFileName(p).Substring(4),out v)?v:new Version(0,0);})){string html=Path.Combine(folder,"resources","app","html");if(File.Exists(Path.Combine(html,"web3d","web3d.nocache.mjs"))){core.SetVirtualHostNameToFolderMapping("papernote-geogebra.local",html,CoreWebView2HostResourceAccessKind.Allow);runtime="https://papernote-geogebra.local/web3d/web3d.nocache.mjs";break;}}
   core.Settings.IsStatusBarEnabled=false;core.Settings.IsZoomControlEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreDevToolsEnabled=debug;
   core.NavigationStarting+=(s,e)=>{if(!e.Uri.StartsWith("https://papernote-math.local/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};
   core.NewWindowRequested+=(s,e)=>e.Handled=true;core.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;core.DownloadStarting+=(s,e)=>e.Cancel=true;
   core.WebMessageReceived+=(s,e)=>{
    if(!e.Source.StartsWith("https://papernote-math.local/",StringComparison.OrdinalIgnoreCase))return;
    try{
     var m=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);string type=(string)m["type"];
     if(type=="math-ready")Send(new{type="math-init",app=app,ggb=ggb,runtime=runtime});
     else if(type=="math-dirty")dirty=true;
     else if(type=="math-result"){
      string data=(string)m["ggb"],png=(string)m["png"];Validate(app,data);
      if(data==""||png.Length>20000000||!Regex.IsMatch(png,@"^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$"))throw new Exception("Chưa xuất được hình. Hãy thử chèn lại.");
      result(new{type="math-result",request=Request,app=app,ggb=data,png=png});
     }
    }catch(Exception error){Reject(error.Message);}
   };
   view.Source=new Uri("https://papernote-math.local/geogebra.html");
  }catch(Exception error){MessageBox.Show(this,error.Message,"Chưa mở được GeoGebra");accepted=true;Close();}
 }
 void Send(object data){if(!IsDisposed&&view.CoreWebView2!=null)view.CoreWebView2.PostWebMessageAsJson(json.Serialize(data));}
 public void Reject(string message){Send(new{type="math-rejected",message=message});}
 public void Accept(){accepted=true;Close();}
}
