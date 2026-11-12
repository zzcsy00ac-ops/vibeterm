/**
 * Tauri API 统一动态导入封装
 * 解决混合导入警告并优化 bundle
 */

// Dialog API
let dialogApi: typeof import('@tauri-apps/plugin-dialog') | null = null;

async function getDialog() {
  if (!dialogApi) {
    dialogApi = await import('@tauri-apps/plugin-dialog');
  }
  return dialogApi;
}

/**
 * 打开文件选择对话框
 */
export async function open(options?: import('@tauri-apps/plugin-dialog').OpenDialogOptions) {
  const { open: dialogOpen } = await getDialog();
  return dialogOpen(options);
}

/**
 * 保存文件对话框
 */
export async function save(options?: import('@tauri-apps/plugin-dialog').SaveDialogOptions) {
  const { save: dialogSave } = await getDialog();
  return dialogSave(options);
}
