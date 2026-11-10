import { useMessages } from "../../../i18n/messages";
import { TextileImageField } from "../textile-set/textile-image-field";
import { replicaMessages } from "./replica-messages";
import { useReplicaDraft } from "./replica-state";

/** 两个必填图片槽明确区分风格来源与需要保留的商品。 */
export function ReplicaReferences() {
  const t = useMessages(replicaMessages);
  const { target, product, update } = useReplicaDraft();
  return (
    <>
      <TextileImageField
        label={t.target}
        description={t.targetHint}
        required
        number={1}
        exampleSrc="/studio/textile-views/front.webp"
        value={target ? [target] : []}
        onChange={(images) => update({ target: images[0] ?? null })}
      />
      <TextileImageField
        label={t.product}
        description={t.productHint}
        required
        number={2}
        exampleSrc="/studio/textile-views/pillow.webp"
        value={product ? [product] : []}
        onChange={(images) => update({ product: images[0] ?? null })}
      />
    </>
  );
}
