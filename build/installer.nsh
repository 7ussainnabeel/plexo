# Custom NSIS hooks, picked up automatically by electron-builder from build/installer.nsh.

# Replaces electron-builder's default finish page (assistedInstaller.nsh) to add a
# "Create a desktop shortcut" checkbox, checked by default. The install step has already created
# the shortcut (createDesktopShortcut in electron-builder.yml), so the checkbox only decides whether
# it stays: unchecked deletes it, checked recreates it if an earlier install left it missing.
# Silent installs and auto-updates skip this page and keep the default behaviour.
!macro customFinishPage
  # Same "Run Plexo" checkbox as the default finish page.
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  # MUI only offers a "Show Readme" checkbox here; we relabel it and point it at our function.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "CreateDesktopShortcut"
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE "RemoveDesktopShortcutIfUnchecked"

  !insertmacro MUI_PAGE_FINISH

  # Defined after MUI_PAGE_FINISH because that is what declares $mui.FinishPage.ShowReadme.

  # Called by the finish page only when the checkbox is checked.
  Function CreateDesktopShortcut
    ${ifNot} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${endIf}
  FunctionEnd

  # Runs when the user clicks Finish, before the checkbox actions above.
  Function RemoveDesktopShortcutIfUnchecked
    ${NSD_GetState} $mui.FinishPage.ShowReadme $0
    ${if} $0 <> ${BST_CHECKED}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${endIf}
  FunctionEnd
!macroend

# Custom install hook: Automatically configures virtual network adapter environment after installation
!macro customInstall
  DetailPrint "Configuring Plexo Virtual Network Adapter..."

  # Allow Plexo through Windows Firewall for inbound/outbound local virtual gateway & multi-adapter bonding
  nsExec::Exec 'netsh advfirewall firewall add rule name="Plexo Virtual Network" dir=in action=allow program="$appExe" enable=yes profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Plexo Virtual Network (Out)" dir=out action=allow program="$appExe" enable=yes profile=any'

  # Disable Windows Connection Manager "Minimize simultaneous connections" policy so Windows doesn't disconnect Wi-Fi when Ethernet or USB tethering is connected
  WriteRegDWORD HKLM "Software\Policies\Microsoft\Windows\WcmSvc\GroupPolicy" "fMinimizeConnections" 0
  WriteRegDWORD HKLM "Software\Policies\Microsoft\Windows\WcmSvc\GroupPolicy" "fBlockNonDomain" 0

  # Optimize multi-adapter routing for link aggregation (WeakHostSend & WeakHostReceive)
  nsExec::Exec 'powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Get-NetIPInterface | Set-NetIPInterface -WeakHostSend Enabled -WeakHostReceive Enabled -ErrorAction SilentlyContinue"'
!macroend

# Custom uninstall hook: Clean up rules
!macro customUnInstall
  DetailPrint "Removing Plexo Virtual Network configuration..."
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Plexo Virtual Network"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Plexo Virtual Network (Out)"'
!macroend

