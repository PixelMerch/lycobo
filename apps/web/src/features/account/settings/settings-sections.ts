/** 账户设置分区；自动化按企业账号开放，成员管理仅面向管理员。 */
export const settingsSections = ["account", "plan", "security", "automation", "members"] as const;

/** 账户设置分区的 id。 */
export type SettingsSection = (typeof settingsSections)[number];
