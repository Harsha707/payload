import type { NextFunction, Response } from 'express'

import type { PayloadRequest } from '../types.js'

import { setRequestContext } from '../setRequestContext.js'

function defaultPayload(req: PayloadRequest, res: Response, next: NextFunction) {
  setRequestContext(req)
  next()
}

export default defaultPayload
