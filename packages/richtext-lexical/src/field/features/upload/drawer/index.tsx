'use client'
import lexicalComposerContextImport from '@lexical/react/LexicalComposerContext.js'
const { useLexicalComposerContext } = lexicalComposerContextImport
import { useListDrawer } from '@payloadcms/ui'
import lexicalImport from 'lexical'
const { $getNodeByKey, COMMAND_PRIORITY_EDITOR } = lexicalImport

import type { LexicalEditor } from 'lexical'

import React, { useCallback, useEffect, useState } from 'react'

import { EnabledRelationshipsCondition } from '../../relationship/utils/EnabledRelationshipsCondition.js'
import { $createUploadNode } from '../nodes/UploadNode.js'
import { INSERT_UPLOAD_COMMAND } from '../plugin/index.js'
import { INSERT_UPLOAD_WITH_DRAWER_COMMAND } from './commands.js'

const baseClass = 'lexical-upload-drawer'

const insertUpload = ({
  id,
  editor,
  relationTo,
  replaceNodeKey,
}: {
  editor: LexicalEditor
  id: string
  relationTo: string
  replaceNodeKey: null | string
}) => {
  if (!replaceNodeKey) {
    editor.dispatchCommand(INSERT_UPLOAD_COMMAND, {
      id,
      fields: null,
      relationTo,
    })
  } else {
    editor.update(() => {
      const node = $getNodeByKey(replaceNodeKey)
      if (node) {
        node.replace(
          $createUploadNode({
            data: {
              fields: null,
              relationTo,
              value: {
                id,
              },
            },
          }),
        )
      }
    })
  }
}

type Props = {
  enabledCollectionSlugs: string[]
}

const UploadDrawerComponent: React.FC<Props> = ({ enabledCollectionSlugs }) => {
  const [editor] = useLexicalComposerContext()

  const [replaceNodeKey, setReplaceNodeKey] = useState<null | string>(null)

  const [ListDrawer, ListDrawerToggler, { closeDrawer, openDrawer }] = useListDrawer({
    collectionSlugs: enabledCollectionSlugs,
    uploads: true,
  })

  useEffect(() => {
    return editor.registerCommand<{
      replace: { nodeKey: string } | false
    }>(
      INSERT_UPLOAD_WITH_DRAWER_COMMAND,
      (payload) => {
        setReplaceNodeKey(payload?.replace ? payload?.replace.nodeKey : null)
        openDrawer()
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor, openDrawer])

  const onSelect = useCallback(
    ({ collectionSlug, docID }) => {
      insertUpload({
        id: docID,
        editor,
        relationTo: collectionSlug,
        replaceNodeKey,
      })
      closeDrawer()
    },
    [editor, closeDrawer, replaceNodeKey],
  )

  return <ListDrawer onSelect={onSelect} />
}

export const UploadDrawer = (props: Props): React.ReactNode => {
  return (
    <EnabledRelationshipsCondition {...props} uploads>
      <UploadDrawerComponent {...props} />
    </EnabledRelationshipsCondition>
  )
}
