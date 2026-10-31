using System;
using System.IO;
using System.Reflection;
using Microsoft.Win32;
class SetupProbe {
 static void Check(bool value,string message){if(!value)throw new Exception(message);Console.WriteLine("PASS "+message);}
 static void CheckLink(string path,string exe,string arguments){
  Check(File.Exists(path),"Shortcut exists: "+Path.GetFileName(path));
  Type type=Type.GetTypeFromProgID("WScript.Shell");object shell=Activator.CreateInstance(type),link=null;
  try{link=type.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});Type lt=link.GetType();string target=(string)lt.InvokeMember("TargetPath",BindingFlags.GetProperty,null,link,null),args=(string)lt.InvokeMember("Arguments",BindingFlags.GetProperty,null,link,null);Check(string.Equals(target,exe,StringComparison.OrdinalIgnoreCase)&&args==arguments,"Shortcut target and arguments: "+Path.GetFileName(path));}
  finally{if(link!=null)System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);}
 }
 [STAThread] static int Main(string[] args){
  try{
   bool complete=args.Length==2&&args[0]=="--complete-install";if(args.Length!=2)throw new ArgumentException("SetupProbe <installer.exe> <test-directory>, or --complete-install <installer.exe>");
   string setupFile=Path.GetFullPath(complete?args[1]:args[0]);var setup=Assembly.LoadFile(setupFile).GetType("Setup");const BindingFlags flags=BindingFlags.NonPublic|BindingFlags.Static;
   string target,menu,desktop;
   if(complete){target=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PaperNote");menu=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"PaperNote");desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);setup.GetMethod("InstallApplication",flags).Invoke(null,new object[]{target,true,setupFile});
    using(var key=Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PaperNote")){Check(key!=null&&(string)key.GetValue("InstallLocation")==target&&(string)key.GetValue("DisplayVersion")=="2.4.1","Windows installation registration");}
   }else{target=Path.GetFullPath(Path.Combine(args[1],"app"));menu=Path.GetFullPath(Path.Combine(args[1],"StartMenu"));desktop=Path.GetFullPath(Path.Combine(args[1],"Desktop"));Directory.CreateDirectory(desktop);setup.GetMethod("Extract",flags).Invoke(null,new object[]{target});File.Copy(setupFile,Path.Combine(target,"Uninstall.exe"),true);setup.GetMethod("CreateShortcuts",flags).Invoke(null,new object[]{menu,desktop,Path.Combine(target,"PaperNote.exe"),Path.Combine(target,"Uninstall.exe"),true});}
   Check(File.Exists(Path.Combine(target,"PaperNote.exe"))&&File.Exists(Path.Combine(target,"web","app.js")),"Installed application payload");
   CheckLink(Path.Combine(menu,"PaperNote.lnk"),Path.Combine(target,"PaperNote.exe"),"");CheckLink(Path.Combine(menu,"Uninstall PaperNote.lnk"),Path.Combine(target,"Uninstall.exe"),"--uninstall");CheckLink(Path.Combine(desktop,"PaperNote.lnk"),Path.Combine(target,"PaperNote.exe"),"");
   Console.WriteLine("Installation verified: "+target);return 0;
  }catch(Exception error){Console.WriteLine(error.GetBaseException().ToString());return 1;}
 }
}
