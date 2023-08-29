import type { Config as GeneratedTypes } from 'payload/generated-types'
import type { DeepPartial } from 'ts-essentials'

import httpStatus from 'http-status'

import type { AccessResult } from '../../config/types.js'
import type { PayloadRequest } from '../../express/types.js'
import type { Where } from '../../types/index.js'
import type { BulkOperationResult, Collection } from '../config/types.js'
import type { CreateUpdateType } from './create.js'

import executeAccess from '../../auth/executeAccess.js'
import { combineQueries } from '../../database/combineQueries.js'
import { validateQueryPaths } from '../../database/queryValidation/validateQueryPaths.js'
import { APIError } from '../../errors/index.js'
import { afterChange } from '../../fields/hooks/afterChange/index.js'
import { afterRead } from '../../fields/hooks/afterRead/index.js'
import { beforeChange } from '../../fields/hooks/beforeChange/index.js'
import { beforeValidate } from '../../fields/hooks/beforeValidate/index.js'
import { deleteAssociatedFiles } from '../../uploads/deleteAssociatedFiles.js'
import { generateFileData } from '../../uploads/generateFileData.js'
import { unlinkTempFiles } from '../../uploads/unlinkTempFiles.js'
import { uploadFiles } from '../../uploads/uploadFiles.js'
import { initTransaction } from '../../utilities/initTransaction.js'
import { killTransaction } from '../../utilities/killTransaction.js'
import { buildVersionCollectionFields } from '../../versions/buildCollectionFields.js'
import { appendVersionToQueryKey } from '../../versions/drafts/appendVersionToQueryKey.js'
import { saveVersion } from '../../versions/saveVersion.js'
import { buildAfterOperation } from './utils.js'

export type Arguments<T extends CreateUpdateType> = {
  collection: Collection
  data: DeepPartial<T>
  depth?: number
  disableVerificationEmail?: boolean
  draft?: boolean
  overrideAccess?: boolean
  overwriteExistingFiles?: boolean
  req: PayloadRequest
  showHiddenFields?: boolean
  where: Where
}
async function update<TSlug extends keyof GeneratedTypes['collections']>(
  incomingArgs: Arguments<GeneratedTypes['collections'][TSlug]>,
): Promise<BulkOperationResult<TSlug>> {
  let args = incomingArgs

  // /////////////////////////////////////
  // beforeOperation - Collection
  // /////////////////////////////////////

  await args.collection.config.hooks.beforeOperation.reduce(async (priorHook, hook) => {
    await priorHook

    args =
      (await hook({
        args,
        context: args.req.context,
        operation: 'update',
      })) || args
  }, Promise.resolve())

  const {
    collection: { config: collectionConfig },
    collection,
    depth,
    draft: draftArg = false,
    overrideAccess,
    overwriteExistingFiles = false,
    req: {
      locale,
      payload: { config },
      payload,
      t,
    },
    req,
    showHiddenFields,
    where,
  } = args

  try {
    const shouldCommit = await initTransaction(req)

    // /////////////////////////////////////
    // beforeOperation - Collection
    // /////////////////////////////////////

    await args.collection.config.hooks.beforeOperation.reduce(async (priorHook, hook) => {
      await priorHook

      args =
        (await hook({
          args,
          context: req.context,
          operation: 'update',
        })) || args
    }, Promise.resolve())

    if (!where) {
      throw new APIError("Missing 'where' query of documents to update.", httpStatus.BAD_REQUEST)
    }

    const { data: bulkUpdateData } = args
    const shouldSaveDraft = Boolean(draftArg && collectionConfig.versions.drafts)

    // /////////////////////////////////////
    // Access
    // /////////////////////////////////////

    let accessResult: AccessResult
    if (!overrideAccess) {
      accessResult = await executeAccess({ req }, collectionConfig.access.update)
    }

    await validateQueryPaths({
      collectionConfig,
      overrideAccess,
      req,
      where,
    })

    // /////////////////////////////////////
    // Retrieve documents
    // /////////////////////////////////////

    const fullWhere = combineQueries(where, accessResult)

    let docs

    if (collectionConfig.versions?.drafts && shouldSaveDraft) {
      const versionsWhere = appendVersionToQueryKey(fullWhere)

      await validateQueryPaths({
        collectionConfig: collection.config,
        overrideAccess,
        req,
        versionFields: buildVersionCollectionFields(collection.config),
        where: versionsWhere,
      })

      const query = await payload.db.queryDrafts<GeneratedTypes['collections'][TSlug]>({
        collection: collectionConfig.slug,
        locale,
        req,
        where: versionsWhere,
      })

      docs = query.docs
    } else {
      const query = await payload.db.find({
        collection: collectionConfig.slug,
        limit: 0,
        locale,
        pagination: false,
        req,
        where: fullWhere,
      })

      docs = query.docs
    }

    // /////////////////////////////////////
    // Generate data for all files and sizes
    // /////////////////////////////////////

    const { data: newFileData, files: filesToUpload } = await generateFileData({
      collection,
      config,
      data: bulkUpdateData,
      overwriteExistingFiles,
      req,
      throwOnMissingFile: false,
    })

    const errors = []

    const promises = docs.map(async (doc) => {
      const { id } = doc
      let data = {
        ...newFileData,
        ...bulkUpdateData,
      }

      try {
        const originalDoc = await afterRead({
          context: req.context,
          depth: 0,
          doc,
          entityConfig: collectionConfig,
          overrideAccess: true,
          req,
          showHiddenFields: true,
        })

        await deleteAssociatedFiles({
          collectionConfig,
          config,
          doc,
          files: filesToUpload,
          overrideDelete: false,
          t,
        })

        // /////////////////////////////////////
        // beforeValidate - Fields
        // /////////////////////////////////////

        data = await beforeValidate<DeepPartial<GeneratedTypes['collections'][TSlug]>>({
          context: req.context,
          data,
          doc: originalDoc,
          entityConfig: collectionConfig,
          id,
          operation: 'update',
          overrideAccess,
          req,
        })

        // /////////////////////////////////////
        // beforeValidate - Collection
        // /////////////////////////////////////

        await collectionConfig.hooks.beforeValidate.reduce(async (priorHook, hook) => {
          await priorHook

          data =
            (await hook({
              context: req.context,
              data,
              operation: 'update',
              originalDoc,
              req,
            })) || data
        }, Promise.resolve())

        // /////////////////////////////////////
        // Write files to local storage
        // /////////////////////////////////////

        if (!collectionConfig.upload.disableLocalStorage) {
          await uploadFiles(payload, filesToUpload, t)
        }

        // /////////////////////////////////////
        // beforeChange - Collection
        // /////////////////////////////////////

        await collectionConfig.hooks.beforeChange.reduce(async (priorHook, hook) => {
          await priorHook

          data =
            (await hook({
              context: req.context,
              data,
              operation: 'update',
              originalDoc,
              req,
            })) || data
        }, Promise.resolve())

        // /////////////////////////////////////
        // beforeChange - Fields
        // /////////////////////////////////////

        let result = await beforeChange<GeneratedTypes['collections'][TSlug]>({
          context: req.context,
          data,
          doc: originalDoc,
          docWithLocales: doc,
          entityConfig: collectionConfig,
          id,
          operation: 'update',
          req,
          skipValidation: shouldSaveDraft || data._status === 'draft',
        })

        // /////////////////////////////////////
        // Update
        // /////////////////////////////////////

        if (!shouldSaveDraft) {
          result = await req.payload.db.updateOne({
            collection: collectionConfig.slug,
            data: result,
            id,
            locale,
            req,
          })
        }

        // /////////////////////////////////////
        // Create version
        // /////////////////////////////////////

        if (collectionConfig.versions) {
          result = await saveVersion({
            collection: collectionConfig,
            docWithLocales: {
              ...result,
              createdAt: doc.createdAt,
            },
            draft: shouldSaveDraft,
            id,
            payload,
            req,
          })
        }

        // /////////////////////////////////////
        // afterRead - Fields
        // /////////////////////////////////////

        result = await afterRead({
          context: req.context,
          depth,
          doc: result,
          entityConfig: collectionConfig,
          overrideAccess,
          req,
          showHiddenFields,
        })

        // /////////////////////////////////////
        // afterRead - Collection
        // /////////////////////////////////////

        await collectionConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
          await priorHook

          result =
            (await hook({
              context: req.context,
              doc: result,
              req,
            })) || result
        }, Promise.resolve())

        // /////////////////////////////////////
        // afterChange - Fields
        // /////////////////////////////////////

        result = await afterChange<GeneratedTypes['collections'][TSlug]>({
          context: req.context,
          data,
          doc: result,
          entityConfig: collectionConfig,
          operation: 'update',
          previousDoc: originalDoc,
          req,
        })

        // /////////////////////////////////////
        // afterChange - Collection
        // /////////////////////////////////////

        await collectionConfig.hooks.afterChange.reduce(async (priorHook, hook) => {
          await priorHook

          result =
            (await hook({
              context: req.context,
              doc: result,
              operation: 'update',
              previousDoc: originalDoc,
              req,
            })) || result
        }, Promise.resolve())

        await unlinkTempFiles({
          collectionConfig,
          config,
          req,
        })

        // /////////////////////////////////////
        // Return results
        // /////////////////////////////////////

        return result
      } catch (error) {
        errors.push({
          id,
          message: error.message,
        })
      }
      return null
    })

    const awaitedDocs = await Promise.all(promises)

    let result = {
      docs: awaitedDocs.filter(Boolean),
      errors,
    }

    // /////////////////////////////////////
    // afterOperation - Collection
    // /////////////////////////////////////

    result = await buildAfterOperation<GeneratedTypes['collections'][TSlug]>({
      args,
      operation: 'update',
      result,
    })

    if (shouldCommit) await payload.db.commitTransaction(req.transactionID)

    return result
  } catch (error: unknown) {
    await killTransaction(req)
    throw error
  }
}

export default update
