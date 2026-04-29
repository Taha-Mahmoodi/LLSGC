export const IPC = {
  // System
  systemStats: 'system:stats',
  systemTick: 'system:tick',

  // Detected servers
  serversList: 'servers:list',
  serversTick: 'servers:tick',
  serversKill: 'servers:kill',
  serversOpen: 'servers:open',
  serversDetails: 'servers:details',
  serversRevealLocation: 'servers:reveal',
  serversCopy: 'servers:copy',

  // Custom servers
  customList: 'custom:list',
  customSave: 'custom:save',
  customRemove: 'custom:remove',
  customStart: 'custom:start',
  customStop: 'custom:stop',
  customRestart: 'custom:restart',
  customLogs: 'custom:logs',
  customLogsClear: 'custom:logs:clear',
  customLogTick: 'custom:log:tick',
  customStatusTick: 'custom:status:tick',

  // Firewall
  firewallList: 'firewall:list',
  firewallBlock: 'firewall:block',
  firewallUnblock: 'firewall:unblock',
  firewallToggle: 'firewall:toggle',
  firewallRefresh: 'firewall:refresh',

  // Hosts file
  hostsList: 'hosts:list',
  hostsSave: 'hosts:save',
  hostsRemove: 'hosts:remove',
  hostsToggle: 'hosts:toggle',

  // Ports availability
  portsCheck: 'ports:check',
  portsCheckMany: 'ports:check-many',
  portsCommon: 'ports:common',

  // HTTP probe
  serversProbe: 'servers:probe',

  // Diagnostics
  diagnosticsRun: 'diagnostics:run',

  // Auto-update (desktop only — web ignores)
  updateCheck: 'update:check',
  updateApply: 'update:apply',
  updateState: 'update:state',

  // Settings
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  // App
  appQuit: 'app:quit',
  appMinimize: 'app:minimize',
  appMaximize: 'app:maximize',
  appPlatform: 'app:platform',
  appOpenExternal: 'app:open-external',
  appPickDirectory: 'app:pick-directory',
  appShowToast: 'app:show-toast',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
