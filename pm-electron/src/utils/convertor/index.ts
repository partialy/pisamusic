import { KGConverter } from "./KGConvertor";
import { WYConvertor } from "./WYConvertor";
import { convertKWSong } from "./KWConvertor";
import { QQConverter } from "./QQConvertor";

export const convertor = {
  KG: KGConverter,
  WY: WYConvertor,
  KW: convertKWSong,
  QQ: QQConverter,
};
