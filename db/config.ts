import { defineDb, defineTable, column } from 'astro:db';

const Comment = defineTable({
  columns: {
    author: column.text(),
    body: column.text(),
    title: column.text(),
  }
})

export default defineDb({
  tables: { Comment },
})