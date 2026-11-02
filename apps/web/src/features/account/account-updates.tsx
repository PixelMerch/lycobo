import { Button, Drawer, Link, Tooltip } from "@heroui/react";
import { IconBell, IconExternalLink, IconList, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import "./account-updates.css";

/** Editorial summary of the published v0.4.4 release, not unreleased local changes. */
const release = {
  version: "v0.4.4",
  date: "2026-11-02",
  title: "图片加载与下载优化",
  description: "减少图片读取请求，优化原图下载流程，让图片浏览与下载更高效。",
  url: "https://github.com/PixelMerch/lycobo/releases/tag/v0.4.4",
};

export function AccountUpdates({ kind }: { kind: "updates" | "messages" }) {
  const updates = kind === "updates";
  const title = updates ? "最近更新" : "消息中心";
  const label = updates ? "更新记录" : "消息";
  return (
    <Drawer>
      <Tooltip delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="account-footer-action"
          aria-label={label}
        >
          <UiIcon icon={updates ? IconList : IconBell} />
        </Button>
        <Tooltip.Content placement="top">{label}</Tooltip.Content>
      </Tooltip>
      <Drawer.Backdrop className="account-news-backdrop">
        <Drawer.Content placement="right" className="account-news-content">
          <Drawer.Dialog className="account-news-panel">
            <Drawer.Header className="account-news-header">
              <div>
                <Drawer.Heading>{title}</Drawer.Heading>
                {!updates && <p>系统消息和活动通知</p>}
              </div>
              <Drawer.CloseTrigger aria-label={`关闭${title}`}>
                <UiIcon icon={IconX} size="action" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body className="account-news-body">
              {updates ? (
                <article className="account-release">
                  <span className="account-release-icon">
                    <UiIcon icon={IconList} size="action" />
                  </span>
                  <div>
                    <h3>{release.title}</h3>
                    <p className="account-release-meta">
                      <span>{release.version}</span>
                      <time dateTime={release.date}>{release.date}</time>
                    </p>
                    <p>{release.description}</p>
                    <Link href={release.url} target="_blank" rel="noopener noreferrer">
                      查看版本详情 <UiIcon icon={IconExternalLink} size="small" />
                    </Link>
                  </div>
                </article>
              ) : (
                <div className="account-news-empty">
                  <span>
                    <UiIcon icon={IconBell} size="illustration" />
                  </span>
                  <h3>消息功能即将开放</h3>
                  <p>敬请期待</p>
                </div>
              )}
            </Drawer.Body>
            {updates && (
              <Drawer.Footer className="account-news-footer">
                <Link
                  href="https://github.com/PixelMerch/lycobo/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看全部更新记录 <UiIcon icon={IconExternalLink} size="small" />
                </Link>
              </Drawer.Footer>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
