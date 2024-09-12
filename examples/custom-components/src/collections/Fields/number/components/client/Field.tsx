'use client'
import type { NumberFieldClientComponent } from 'payload'

import { NumberField } from '@payloadcms/ui'
import React from 'react'

export const CustomNumberFieldClient: NumberFieldClientComponent = ({ field }) => {
  return <NumberField field={field} />
}
