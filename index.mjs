import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import fs from 'fs/promises';
import { transform } from 'esbuild';
import { generate } from 'astring';

//!Important. Currently UpdateExpressions with the operator as prefix are broken
//! ++i and i++ will behave the same, no solution has been found yet
//!Always true or always false expressions like !"string" with also be transformed into their supposed value

/**
 * @type {import('esbuild').Plugin}
 */
export const OverloadPlugin = {
  name: 'OverloadPlugin',
  setup(pluginBuild) {

    pluginBuild.onResolve({ filter: /^OperatorSymbols$/ }, async opts => {
      return {
        namespace: 'overload-plugin',
        path: 'PROXY'
      };
    });


    pluginBuild.onResolve({ filter: /^__operators$/ }, async opts => {
      return {
        namespace: 'overload-plugin',
        path: 'OPERATOR'
      };
    });


    pluginBuild.onLoad({ filter: /.*/, namespace: 'overload-plugin' }, async opts => {
      if (opts.path == 'PROXY')
        return {
          contents: 'export default new Proxy({}, { get: (_, op) => Symbol.for(op) });'
        };

      if (opts.path == 'OPERATOR')
        return {
          contents: [
            function __binop(l, r, op) {
              if (l != null && l[Symbol.for(op)]) return l[Symbol.for(op)](l, r);

              switch (op) {
                case "==": return l == r;
                case "!=": return l != r;
                case "===": return l === r;
                case "!==": return l !== r;
                case "<": return l < r;
                case "<=": return l <= r;
                case ">": return l > r;
                case ">=": return l >= r;
                case "<<": return l << r;
                case ">>": return l >> r;
                case ">>>": return l >>> r;
                case "+": return l + r;
                case "-": return l - r;
                case "*": return l * r;
                case "/": return l / r;
                case "%": return l % r;
                case "|": return l | r;
                case "^": return l ^ r;
                case "&": return l & r;
                case "in": return l in r;
                case "instanceof": return l instanceof r;
                case "**": return l ** r;
              }
              throw new SyntaxError('Invalid binary operator: ' + op);
            },
            function __unop(v, op) {
              if (v != null && v[Symbol.for(op)]) return v[Symbol.for(op)](v);

              switch (op) {
                case "-": return - v;
                case "+": return + v;
                case "!": return !v;
                case "~": return ~v;
                case "typeof": return typeof v;
                case "void": return void v;
              }

              throw new SyntaxError('Invalid unary operator: ' + op);
            },
            function __updateop(v, op, prefix) {
              if (!Object.getOwnPropertyDescriptor(__updateop, 'temp')) {
                Object.defineProperty(__updateop, 'temp', {
                  set(v) { __updateop.__temp = v; },
                  get() { var _ = __updateop.__temp; delete __updateop.__temp; return _; }
                });
              }
              
              if (v != null && v[Symbol.for(op)]) return v[Symbol.for(op)](v, prefix);

              switch (op) {
                case "++": return prefix ? ++v : v++;
                case "--": return prefix ? --v : v--;
              }

              throw new SyntaxError('Invalid update operator: ' + op);
            },
            function __assignop(l, r, op) {
              if (l != null && l[Symbol.for(op)]) return l[Symbol.for(op)](l, r);
              switch (op) {
                case "=": return r;
                case "+=": return l + r;
                case "-=": return l - r;
                case "*=": return l * r;
                case "/=": return l / r;
                case "%=": return l % r;
                case "<<=": return l << r;
                case ">>=": return l >> r;
                case ">>>=": return l >>> r;
                case "|=": return l | r;
                case "^=": return l ^ r;
                case "&=": return l & r;
                case "**=": return l ** r;
                case "||=": return l || r;
                case "&&=": return l && r;
                case "??=": return l ?? r;
              }

              throw new SyntaxError('Invalid assignment operator: ' + op);
            },
            function __logop(l, r, op) {
              if (l != null && l[Symbol.for(op)]) return l[Symbol.for(op)](l, r);

              switch (op) {
                case "||": return l || r;
                case "&&": return l && r;
                case "??": return l ?? r;
              }

              throw new SyntaxError('Invalid logical operator: ' + op);
            }
          ].reduce((prev, cur) => prev + `export ${cur.toString()}\n`, '')
        };
    });


    pluginBuild.onLoad({ filter: /.*/ }, async opts => {

      const file = await fs.readFile(opts.path, { encoding: 'utf8' });
      const { code } = await transform(file, { loader: 'tsx' });
      const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

      simple(ast, {
        BinaryExpression(node) {
          node.type = 'CallExpression';
          node.callee = {
            type: 'Identifier',
            name: '__binop'
          };
          node.arguments = [node.left, node.right, {
            type: 'Literal',
            value: node.operator,
          }];
        },

        AssignmentExpression(node) {
          node.right.arguments = [node.left, { ...node.right }, {
            type: 'Literal',
            value: node.operator,
          }];
          node.right.type = 'CallExpression';
          node.right.callee = {
            type: 'Identifier',
            name: '__assignop'
          };
          node.operator = '=';
        },

        LogicalExpression(node) {
          node.type = 'CallExpression';
          node.callee = {
            type: 'Identifier',
            name: '__logop'
          };
          node.arguments = [node.left, node.right, {
            type: 'Literal',
            value: node.operator,
          }];
        },

        UnaryExpression(node) {
          node.type = 'CallExpression';
          node.callee = {
            type: 'Identifier',
            name: '__unop'
          };
          node.arguments = [node.argument, {
            type: 'Literal',
            value: node.operator,
          },
          {
            type: 'Literal',
            value: node.prefix,
          }];
        },
        UpdateExpression(node) {
          node.expressions = [
            {
              type: 'AssignmentExpression',
              operator: '=',
              left: node.argument,
              right: {
                type: 'CallExpression',
                callee: {
                  type: 'Identifier',
                  name: '__updateop'
                },
                arguments: [
                  node.argument,
                  {
                    type: 'Literal',
                    value: node.operator,
                  },
                  {
                    type: 'Literal',
                    value: node.prefix,
                  }
                ]
              }
            },
            {
              type: 'Identifier',
              name: node.prefix ? node.argument.name : '__updateop.temp'
            }
          ];
          if (!node.prefix) node.expressions.unshift({
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'Identifier',
              name: '__updateop.temp'
            },
            right: node.argument
          });
          node.type = 'SequenceExpression';

        }
      });

      return {
        contents: `import {__binop, __unop, __updateop, __assignop, __logop} from '__operators'\n` + generate(ast)
      };

    });
  }
};
