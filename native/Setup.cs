using System;
using System.IO;
using System.IO.Compression;
using System.Drawing;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

class Setup : Form {
 string destination=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PaperNote");
 Label status;Button install;CheckBox desktop,launch;bool done=false;
 const string RegPath="Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PaperNote";
 [STAThread] static void Main(string[] args){Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  try{
   if(args.Length==2&&args[0]=="--extract-only"){Extract(Path.GetFullPath(args[1]));return;}
   if(args.Length>0&&args[0]=="--uninstall"){Uninstall();return;}
   Application.Run(new Setup());
  }catch(Exception e){MessageBox.Show(e.GetBaseException().Message,"PaperNote Setup");Environment.ExitCode=1;}
 }
 Setup(){
  Text="Cài đặt PaperNote";ClientSize=new Size(550,365);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.White;Font=new Font("Segoe UI",10);
  Controls.Add(new Label(){Text="PaperNote",Font=new Font("Segoe UI",25,FontStyle.Bold),Location=new Point(32,23),AutoSize=true,ForeColor=Color.FromArgb(23,74,130)});
  Controls.Add(new Label(){Text="Sổ ghi chú cho Windows",Location=new Point(35,82),AutoSize=true,ForeColor=Color.FromArgb(85,105,130)});
  Controls.Add(new Label(){Text="Viết tay, ghi chú PDF và giữ mọi ý tưởng trên máy của bạn.\nBản ứng dụng độc lập lấy cảm hứng từ Goodnotes.",Location=new Point(35,125),Size=new Size(485,48)});
  status=new Label(){Text="Thư mục: "+destination,Location=new Point(35,188),Size=new Size(485,45),Font=new Font("Segoe UI",8.5f),ForeColor=Color.DimGray};Controls.Add(status);
  desktop=new CheckBox(){Text="Tạo lối tắt trên màn hình Desktop",Checked=true,Location=new Point(35,239),AutoSize=true};Controls.Add(desktop);
  launch=new CheckBox(){Text="Mở PaperNote sau khi cài đặt",Checked=true,Location=new Point(35,269),AutoSize=true};Controls.Add(launch);
  install=new Button(){Text="Cài đặt",Location=new Point(385,312),Size=new Size(130,34),BackColor=Color.FromArgb(25,103,210),ForeColor=Color.White,FlatStyle=FlatStyle.Flat};Controls.Add(install);install.Click+=Install;AcceptButton=install;
 }
 static void Extract(string target){Directory.CreateDirectory(target);using(var resource=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var zip=new ZipArchive(resource,ZipArchiveMode.Read)){
  string prefix=Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
  foreach(var entry in zip.Entries){string output=Path.GetFullPath(Path.Combine(target,entry.FullName));if(!output.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))throw new Exception("Tệp cài đặt không hợp lệ.");if(entry.FullName.EndsWith("/")){Directory.CreateDirectory(output);continue;}Directory.CreateDirectory(Path.GetDirectoryName(output));using(var input=entry.Open())using(var file=File.Create(output))input.CopyTo(file);}
 }}
 static string StartFolder(){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"PaperNote");}
 static void Shortcut(string path,string exe,string arguments=""){
  Type type=Type.GetTypeFromProgID("WScript.Shell");object shell=Activator.CreateInstance(type);object link=type.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});Type lt=link.GetType();
  lt.InvokeMember("TargetPath",BindingFlags.SetProperty,null,link,new object[]{exe});lt.InvokeMember("Arguments",BindingFlags.SetProperty,null,link,new object[]{arguments});lt.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,link,new object[]{Path.GetDirectoryName(exe)});lt.InvokeMember("IconLocation",BindingFlags.SetProperty,null,link,new object[]{exe+",0"});lt.InvokeMember("Save",BindingFlags.InvokeMethod,null,link,null);
  System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
 }
 static void CreateShortcuts(string menu,string desktopFolder,string exe,string uninstaller,bool includeDesktop){
  Directory.CreateDirectory(menu);Shortcut(Path.Combine(menu,"PaperNote.lnk"),exe);
  // WScript.Save cannot handle some Unicode .lnk filenames under .NET Framework.
  Shortcut(Path.Combine(menu,"Uninstall PaperNote.lnk"),uninstaller,"--uninstall");
  if(includeDesktop)Shortcut(Path.Combine(desktopFolder,"PaperNote.lnk"),exe);
 }
 static void InstallApplication(string target,bool includeDesktop,string setupFile){
  string exe=Path.GetFullPath(Path.Combine(target,"PaperNote.exe"));
  foreach(var process in Process.GetProcessesByName("PaperNote"))using(process){
   string runningPath;try{runningPath=process.MainModule.FileName;}catch(System.ComponentModel.Win32Exception){continue;}catch(InvalidOperationException){continue;}
   if(string.Equals(runningPath,exe,StringComparison.OrdinalIgnoreCase))throw new Exception("Hãy đóng PaperNote trước khi cập nhật ứng dụng.");
  }
  Extract(target);string uninstaller=Path.Combine(target,"Uninstall.exe");
  if(!string.Equals(Path.GetFullPath(setupFile),Path.GetFullPath(uninstaller),StringComparison.OrdinalIgnoreCase))File.Copy(setupFile,uninstaller,true);
  CreateShortcuts(StartFolder(),Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),exe,uninstaller,includeDesktop);
  using(var key=Registry.CurrentUser.CreateSubKey(RegPath)){key.SetValue("DisplayName","PaperNote");key.SetValue("DisplayVersion","2.4.1");key.SetValue("Publisher","PaperNote Local");key.SetValue("DisplayIcon",exe);key.SetValue("InstallLocation",target);key.SetValue("UninstallString","\""+uninstaller+"\" --uninstall");key.SetValue("NoModify",1);key.SetValue("NoRepair",1);}
 }
 void Install(object sender,EventArgs args){
  if(done){Close();return;}install.Enabled=false;status.Text="Đang cài đặt…";Application.DoEvents();
  try{
   InstallApplication(destination,desktop.Checked,Application.ExecutablePath);string exe=Path.Combine(destination,"PaperNote.exe");
   status.Text="Đã cài đặt. Dữ liệu được giữ trong %LOCALAPPDATA%\\PaperNote\\Data.";done=true;install.Text="Hoàn tất";desktop.Enabled=launch.Enabled=false;install.Enabled=true;if(launch.Checked)Process.Start(new ProcessStartInfo(exe){UseShellExecute=true});
  }catch(Exception e){status.Text="Cài đặt chưa hoàn tất.";install.Enabled=true;MessageBox.Show(e.GetBaseException().Message,"PaperNote Setup");}
 }
 static void Uninstall(){
  if(MessageBox.Show("Gỡ ứng dụng PaperNote? Sổ tay và bản sao lưu trên máy sẽ được giữ nguyên.","Gỡ PaperNote",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
  foreach(var p in Process.GetProcessesByName("PaperNote")){p.Dispose();throw new Exception("Hãy đóng PaperNote trước khi gỡ cài đặt.");}
  string installed=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);string expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PaperNote");
  if(!string.Equals(Path.GetFullPath(installed),Path.GetFullPath(expected),StringComparison.OrdinalIgnoreCase))throw new Exception("Hãy gỡ từ Cài đặt Windows hoặc lối tắt Gỡ PaperNote.");
  string shortcut=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"PaperNote.lnk");if(File.Exists(shortcut))File.Delete(shortcut);
  if(Directory.Exists(StartFolder()))Directory.Delete(StartFolder(),true);Registry.CurrentUser.DeleteSubKeyTree(RegPath,false);
  // Use one PowerShell process and a fixed, verified absolute path; retain user data.
  string quoted=installed.Replace("'","''");string command="Start-Sleep -Seconds 2; Remove-Item -LiteralPath '"+quoted+"' -Recurse -Force";
  string encoded=Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(command));Process.Start(new ProcessStartInfo("powershell.exe","-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "+encoded){UseShellExecute=false,CreateNoWindow=true});
  MessageBox.Show("Đã gỡ ứng dụng. Dữ liệu sổ tay vẫn được giữ nguyên.","PaperNote");
 }
}
