Dim fso, shell, scriptDir, projectDir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = projectDir

cmd = "node """ & projectDir & "\src\index.mjs"" launch --gui-alert"
shell.Run cmd, 0, False
