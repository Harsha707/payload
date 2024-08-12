import type {
  SerializedLineBreakNode as _SerializedLineBreakNode,
  SerializedTextNode as _SerializedTextNode,
  SerializedEditorState,
  SerializedElementNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical'

import type { SerializedAutoLinkNode, SerializedLinkNode } from './features/link/nodes/types.js'
import type { SerializedListItemNode, SerializedListNode } from './features/lists/plugin/index.js'

export type {
  SerializedAutoLinkNode,
  SerializedLinkNode,
  SerializedListItemNode,
  SerializedListNode,
}

export type SerializedParagraphNode<T extends SerializedLexicalNode = SerializedLexicalNode> =
  Spread<
    {
      textFormat: number
      type: 'paragraph'
    },
    SerializedElementNode<T>
  >
export type SerializedTextNode = Spread<
  {
    children?: never // required so that our typed editor state doesn't automatically add children
    type: 'text'
  },
  _SerializedTextNode
>

export type SerializedLineBreakNode = Spread<
  {
    children?: never // required so that our typed editor state doesn't automatically add children
    type: 'linebreak'
  },
  _SerializedLineBreakNode
>

type RecursiveNodes<T extends SerializedLexicalNode, Depth extends number = 4> = Depth extends 0
  ? T
  : { children?: RecursiveNodes<T, DecrementDepth<Depth>>[] } & T

type DecrementDepth<N extends number> = [0, 0, 1, 2, 3, 4][N]

export type TypedEditorState<T extends SerializedLexicalNode = SerializedLexicalNode> =
  SerializedEditorState<RecursiveNodes<T>>

export type DefaultNodeTypes =
  | SerializedAutoLinkNode
  //| SerializedBlockNode // Not included by default
  | SerializedLineBreakNode
  | SerializedLinkNode
  | SerializedListItemNode
  | SerializedListNode
  | SerializedParagraphNode
  | SerializedTextNode

export type DefaultTypedEditorState<T extends SerializedLexicalNode = SerializedLexicalNode> =
  TypedEditorState<DefaultNodeTypes | T>
