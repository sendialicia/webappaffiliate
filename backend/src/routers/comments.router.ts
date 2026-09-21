import { Router } from 'express'
import {
  createAnnotationHandler,
  createCommentHandler,
  deleteAnnotationHandler,
  deleteCommentHandler,
  healthHandler,
  listAnnotationsHandler,
  listCommentsHandler,
  updateAnnotationHandler,
  updateCommentHandler,
} from '../controllers/comments.controller'

export const commentsRouter = Router()

commentsRouter.get('/api/comments/health', healthHandler)

commentsRouter.get('/api/comments', listCommentsHandler)
commentsRouter.post('/api/comments', createCommentHandler)
commentsRouter.patch('/api/comments/:id', updateCommentHandler)
commentsRouter.delete('/api/comments/:id', deleteCommentHandler)

commentsRouter.get('/api/annotations', listAnnotationsHandler)
commentsRouter.post('/api/annotations', createAnnotationHandler)
commentsRouter.patch('/api/annotations/:id', updateAnnotationHandler)
commentsRouter.delete('/api/annotations/:id', deleteAnnotationHandler)
