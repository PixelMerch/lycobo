import { useMessages } from "../../../i18n/messages";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { replicaMessages } from "./replica-messages";
import { useReplicaDraft } from "./replica-state";

/** 目标图提供共同风格，每张商品参考图分别生成一张结果。 */
export function ReplicaReferences() {
  const t = useMessages(replicaMessages);
  const { target, products, update } = useReplicaDraft();
  return (
    <>
      <section aria-label={t.target}>
        <ReferencePicker
          compact
          label={t.target}
          isRequired
          showCount={false}
          limit={1}
          prompt=""
          references={target ? [target] : []}
          onChange={(images) => update({ target: images[0] ?? null })}
        />
      </section>
      <section aria-label={t.product}>
        <ReferencePicker
          compact
          label={t.product}
          limit={10}
          prompt=""
          references={products}
          onChange={(products) => update({ products })}
        />
      </section>
    </>
  );
}
