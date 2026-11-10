import { tables1 } from './tables1';
import { tables2 } from './tables2';
import { tables3 } from './tables3';
import { tables4 } from './tables4';
import { tables5 } from './tables5';
import { SchemaTable } from '../types';
/** 受控显式5.7建表定义；默认值保留SQLite原SQL字面量供迁移校验使用。 */
export const MYSQL_TABLES: readonly SchemaTable[] = [...tables1, ...tables2, ...tables3, ...tables4, ...tables5];
