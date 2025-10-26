import {
	pgTable,
	text,
	integer,
	doublePrecision,
	primaryKey,
	uniqueIndex,
	index,
	serial,
	timestamp
} from 'drizzle-orm/pg-core';

export const users = pgTable(
	'users',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		avatar: text('avatar'),
		bio: text('bio'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => ({
		slugIdx: uniqueIndex('users_slug_unique').on(table.slug)
	})
);

export const videos = pgTable(
	'videos',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description').notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		videoUrl: text('video_url'),
		thumbnailUrl: text('thumbnail_url'),
		duration: integer('duration').notNull().default(0),
		uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
		views: integer('views').notNull().default(0),
		likes: integer('likes').notNull().default(0),
		latitude: doublePrecision('latitude'),
		longitude: doublePrecision('longitude'),
		transcript: text('transcript'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => ({
		userIdx: index('videos_user_idx').on(table.userId)
	})
);

export const tags = pgTable(
	'tags',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull()
	},
	(table) => ({
		nameIdx: uniqueIndex('tags_name_unique').on(table.name)
	})
);

export const videoTags = pgTable(
	'video_tags',
	{
		videoId: text('video_id')
			.notNull()
			.references(() => videos.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(table) => ({
		pk: primaryKey({ columns: [table.videoId, table.tagId] })
	})
);

export const userFollows = pgTable(
	'user_follows',
	{
		followerId: integer('follower_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		followingId: integer('following_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(table) => ({
		pk: primaryKey({ columns: [table.followerId, table.followingId] })
	})
);

export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferSelect;
export type VideoInsert = typeof videos.$inferInsert;
export type VideoSelect = typeof videos.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type TagSelect = typeof tags.$inferSelect;

import { relations } from 'drizzle-orm';

// A user can have many videos, and be a follower/followee
export const usersRelations = relations(users, ({ many }) => ({
	videos: many(videos),
	// This part was missing:
	followers: many(userFollows, { relationName: 'followers' }),
	following: many(userFollows, { relationName: 'following' })
}));

// A video belongs to one user and can have many tags
export const videosRelations = relations(videos, ({ one, many }) => ({
	user: one(users, {
		fields: [videos.userId],
		references: [users.id]
	}),
	videoTags: many(videoTags)
}));

// A tag can be on many videos
export const tagsRelations = relations(tags, ({ many }) => ({
	videoTags: many(videoTags)
}));

// --- Many-to-Many Join Table Relations ---

// videoTags (joins videos and tags)
export const videoTagsRelations = relations(videoTags, ({ one }) => ({
	video: one(videos, {
		fields: [videoTags.videoId],
		references: [videos.id]
	}),
	tag: one(tags, {
		fields: [videoTags.tagId],
		references: [tags.id]
	})
}));

// userFollows (joins users to users)
export const userFollowsRelations = relations(userFollows, ({ one }) => ({
	follower: one(users, {
		fields: [userFollows.followerId],
		references: [users.id],
		relationName: 'followers' // 'followers' tracks who is following a user
	}),
	following: one(users, {
		fields: [userFollows.followingId],
		references: [users.id],
		relationName: 'following' // 'following' tracks who a user is following
	})
}));
