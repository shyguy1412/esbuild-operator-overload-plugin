declare module 'OperatorSymbols' {
  export type UnaryOperator = "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";
  export type UpdateOperator = "++" | "--";
  export type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "|" | "^" | "&" | "in" | "instanceof" | "**";
  export type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=" | "|=" | "^=" | "&=" | "**=" | "||=" | "&&=" | "??=";
  export type LogicalOperator = "||" | "&&" | "??";
  export type Operator = UnaryOperator | UpdateOperator | BinaryOperator | AssignmentOperator | LogicalOperator;
  const OperatorSymbols: Record<Operator, symbol>;
  export default OperatorSymbols;
}