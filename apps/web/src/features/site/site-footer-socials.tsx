import {
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { siteFooterMessages } from "./site-footer-messages";

const socialPlatforms = [
  { id: "x", icon: IconBrandX },
  { id: "youtube", icon: IconBrandYoutube },
  { id: "instagram", icon: IconBrandInstagram },
  { id: "tiktok", icon: IconBrandTiktok },
] as const;

/** 官方账号未配置，按用户要求展示静态标识，不提供虚构链接或按钮。 */
export function SiteFooterSocials() {
  const t = useMessages(siteFooterMessages);
  return (
    <ul className="site-footer-socials" aria-label={t.socialMedia}>
      {socialPlatforms.map(({ id, icon }) => (
        <li key={id}>
          <span className="site-footer-social" role="img" aria-label={t.socialNames[id]}>
            <UiIcon icon={icon} size="action" />
          </span>
        </li>
      ))}
    </ul>
  );
}
