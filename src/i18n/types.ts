/**
 * i18next 类型声明
 * 为翻译函数提供类型安全，避免使用 (t as any)
 *
 * 注意：由于 i18next 类型系统的限制，这里只导出类型定义
 * 而不扩展 CustomTypeOptions 接口
 */
import 'i18next';

// 定义翻译资源的类型结构（用于类型检查）
export interface TranslationResources {
  common: {
    buttons: {
      cancel: string;
      confirm: string;
      delete: string;
      save: string;
      ok: string;
      create: string;
      add: string;
    };
    cancel: string;
    confirm: string;
  };
  home: {
    welcome: string;
  };
  app: {
    update: string;
    settings: string;
    about: string;
    logout: string;
    chats: string;
    sshManager: string;
    providerManager: string;
    sidebar: string;
  };
  chat: {
    newChat: {
      defaultTitle: string;
    };
    sidebar: {
      title: string;
      newChat: string;
      empty: string;
      yesterday: string;
      confirmDelete: string;
      deleteDialog: {
        title: string;
        message: string;
      };
    };
    contextMenu: {
      rename: string;
      delete: string;
    };
    renameDialog: {
      title: string;
      description: string;
      placeholder: string;
    };
    interface: {
      noConversation: string;
      selectOrCreate: string;
      startConversation: string;
      selectModel: string;
      retry: string;
      thinking: string;
      placeholder: string;
      assistant: string;
    };
  };
  ssh: {
    passwordPrompt: {
      title: string;
      enterPasswordFor: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      savePasswordToKeychain: string;
      cancel: string;
      connect: string;
      connecting: string;
    };
    keychain: {
      passwordNotFound: string;
      getPasswordFailed: string;
    };
  };
  provider: {
    model: {
      addModel: string;
      empty: string;
      removeModel: string;
    };
  };
  sftp: {
    fileList: {
      loading: string;
    };
  };
  monitor: {
    error: {
      invalidParams: string;
      invalidParamsDesc: string;
    };
  };
  skill: {
    preset: string;
    toggleActive: string;
    export: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    cannotDeletePreset: string;
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    descriptionHint: string;
    triggerKeywords: string;
    triggerKeywordsPlaceholder: string;
    triggerKeywordsHint: string;
    instructions: string;
    instructionsPlaceholder: string;
    instructionsHint: string;
    createTitle: string;
    editTitle: string;
    validation: {
      nameRequired: string;
      descriptionRequired: string;
      instructionsRequired: string;
    };
    importError: string;
    importSuccess: string;
    importFailed: string;
    resetConfirm: string;
  };
  skills: {
    title: string;
    subtitle: string;
    reset: string;
    import: string;
    exportAll: string;
    create: string;
    total: string;
    active: string;
    empty: string;
  };
  skillSelector: {
    none: string;
    count: string;
    title: string;
    settings: string;
    empty: string;
    hint: string;
  };
  settings: {
    nav: {
      general: string;
      appearance: string;
      skills: string;
      data: string;
      contact: string;
    };
  };
}
