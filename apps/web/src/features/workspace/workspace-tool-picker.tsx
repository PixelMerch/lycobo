import {
  Button,
  Input,
  ListBox,
  Modal,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  IconArrowUpRight,
  IconLayoutGrid,
  IconPlayerPlayFilled,
  IconSearch,
} from "@tabler/icons-react";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { shareProductReference, toolForPath, workspaceTools } from "./workspace-state";
import { WorkspaceToolSymbol } from "./workspace-tool-symbol";

const categories = ["全部工具", "主图制作", "套图与裂变", "商品视频"];
export function WorkspaceToolPicker() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = toolForPath(pathname);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部工具");
  const visible = workspaceTools.filter(
    (tool) =>
      (category === "全部工具" || tool.category === category) &&
      `${tool.name}${tool.description}`.includes(search.trim()),
  );
  return (
    <>
      <MotionConfig reducedMotion="user">
        <motion.nav layoutScroll className="workspace-tool-bar" aria-label="电商创作工具">
          {workspaceTools.map((tool) => (
            <Button
              key={tool.id}
              size="sm"
              variant="tertiary"
              className="workspace-tool-shortcut"
              data-tool={tool.id}
              aria-label={tool.name}
              aria-current={current.id === tool.id ? "page" : false}
              onPress={() => {
                shareProductReference(pathname, tool.path);
                navigate(tool.path);
              }}
            >
              {current.id === tool.id && (
                <motion.span
                  layoutId="workspace-tool-indicator"
                  className="workspace-tool-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              <WorkspaceToolSymbol tool={tool.id} />
              <span className="workspace-tool-label">
                <span className="workspace-tool-name">{tool.name}</span>
              </span>
            </Button>
          ))}
          <span className="workspace-tool-divider" aria-hidden="true" />
          <Button
            className="workspace-tool-shortcut workspace-tool-more"
            size="sm"
            variant="tertiary"
            aria-label="全部工具"
            onPress={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="workspace-tool-symbol" aria-hidden="true">
              <UiIcon icon={IconLayoutGrid} size="navigation" />
            </span>
            <span className="workspace-tool-label">
              <span className="workspace-tool-name">全部工具</span>
            </span>
          </Button>
        </motion.nav>
      </MotionConfig>
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop className="workspace-tools-backdrop">
          <Modal.Container>
            <Modal.Dialog className="workspace-tools-dialog">
              <Modal.Header className="workspace-tools-header">
                <Modal.Heading>选择工具</Modal.Heading>
                <TextField
                  className="workspace-tool-search"
                  value={search}
                  onChange={setSearch}
                  aria-label="搜索电商工具"
                >
                  <UiIcon icon={IconSearch} size="small" />
                  <Input autoFocus placeholder="搜索工具" />
                </TextField>
                <DialogClose label="关闭工具选择" />
              </Modal.Header>
              <Modal.Body className="workspace-tools-content">
                <div className="workspace-tools-body">
                  <ToggleButtonGroup
                    className="workspace-tool-categories"
                    aria-label="工具分类"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[category]}
                    onSelectionChange={(keys) => {
                      const next = Array.from(keys)[0];
                      if (next) setCategory(String(next));
                    }}
                  >
                    {categories.map((name) => (
                      <ToggleButton key={name} id={name}>
                        {name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Select
                    className="workspace-mobile-category"
                    aria-label="工具分类"
                    value={category}
                    onChange={(key) => {
                      if (key) setCategory(String(key));
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {categories.map((name) => (
                          <ListBox.Item key={name} id={name} textValue={name}>
                            {name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <div className="workspace-tool-cards">
                    {visible.map((tool) => (
                      <Button
                        key={tool.id}
                        variant="secondary"
                        className="workspace-tool-card"
                        data-current={tool.id === current.id || undefined}
                        onPress={() => {
                          shareProductReference(pathname, tool.path);
                          navigate(tool.path);
                          setOpen(false);
                        }}
                      >
                        <span
                          className={`workspace-tool-art workspace-tool-art--${tool.id}`}
                          aria-hidden="true"
                        >
                          <img src={tool.image} alt="" loading="lazy" />
                          {tool.id === "textile" && (
                            <img src="/studio/textile-views/pillow.webp" alt="" loading="lazy" />
                          )}
                          {tool.id === "variation" && (
                            <span className="workspace-plan-sheets">
                              <span />
                              <span />
                              <span />
                            </span>
                          )}
                          {tool.id === "video" && (
                            <span className="workspace-video-symbol">
                              <UiIcon icon={IconPlayerPlayFilled} size="action" />
                            </span>
                          )}
                        </span>
                        <span className="workspace-tool-caption">
                          <span className="workspace-tool-title">
                            <strong>{tool.name}</strong>
                            <UiIcon icon={IconArrowUpRight} size="small" />
                          </span>
                          <small>{tool.description}</small>
                        </span>
                        {tool.id === "variation" ? (
                          <span className="workspace-tool-badge">先确认计划</span>
                        ) : tool.id === "video" ? (
                          <span className="workspace-tool-badge">768p</span>
                        ) : (
                          tool.id === current.id && (
                            <span className="workspace-tool-badge">当前使用</span>
                          )
                        )}
                      </Button>
                    ))}
                    {!visible.length && <p className="workspace-tools-empty">没有匹配的工具</p>}
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
