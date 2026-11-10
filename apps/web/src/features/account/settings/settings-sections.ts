/** 账户设置左侧的分区；企业成员只对管理员显示。 */
export const settingsSections = ["account", "plan", "security", "members"] as const;

/** 账户设置分区的 id。 */
export type SettingsSection = (typeof settingsSections)[number];
