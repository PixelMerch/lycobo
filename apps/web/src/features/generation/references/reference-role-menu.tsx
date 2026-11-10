import { Description, Dropdown, Label, type Selection } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { referenceRoles, roleOf, useReferenceRoles } from "./reference-roles";
import { referencesMessages } from "./references-messages";
import "./reference-role-menu.css";

/** 参考图左下角的角色胶囊：点开选择商品、原图或风格；角色只记在本次会话里。 */
export function ReferenceRoleMenu({
  imageId,
  name,
  isDisabled = false,
}: {
  imageId: string;
  name: string;
  isDisabled?: boolean;
}) {
  const t = useMessages(referencesMessages);
  const role = useReferenceRoles((state) => roleOf(state.roles, imageId));
  const setRole = useReferenceRoles((state) => state.setRole);
  function select(keys: Selection) {
    if (keys === "all") return;
    const next = referenceRoles.find((id) => keys.has(id));
    if (next) setRole(imageId, next);
  }
  return (
    <Dropdown>
      <Dropdown.Trigger
        className="reference-role-trigger"
        data-role={role}
        aria-label={t.roleOfImage(name, t.roles[role])}
        isDisabled={isDisabled}
      >
        {t.roles[role]}
        <UiIcon icon={IconChevronDown} size="small" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="reference-role-menu" placement="bottom start" offset={6}>
        <Dropdown.Menu
          aria-label={t.chooseRole(name)}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[role]}
          onSelectionChange={select}
        >
          {referenceRoles.map((id) => (
            <Dropdown.Item
              key={id}
              id={id}
              textValue={t.roles[id]}
              className="reference-role-option"
            >
              <span className="reference-role-copy">
                <Label>{t.roles[id]}</Label>
                <Description>{t.roleHints[id]}</Description>
              </span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
