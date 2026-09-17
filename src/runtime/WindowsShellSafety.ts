/** cmd.exe expands these characters even when child_process builds quoted arguments. */
export function assertWindowsShellArguments(command: string, args: string[]): void {
  if ([command, ...args].some(value => /[&|<>^()%!\r\n"]/.test(value))) {
    throw new Error('Unsafe Windows batch argument. Use a registered Node/PowerShell script with JSON arguments instead.');
  }
}
