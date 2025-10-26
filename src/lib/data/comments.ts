import type { Comment } from '$lib/types/content';

export const comments: Comment[] = [
	{
		id: 1,
		user: 'Sarah Chen',
		avatar: 'https://i.pravatar.cc/150?img=1',
		content:
			'The lighting in this scene is particularly striking. The way the shadows fall creates a dramatic contrast.',
		timestamp: '2 hours ago',
		likes: 12
	},
	{
		id: 2,
		user: 'Michael Rodriguez',
		avatar: 'https://i.pravatar.cc/150?img=2',
		content:
			'I notice the subtle camera movement here - it adds a lot of depth to the composition.',
		timestamp: '5 hours ago',
		likes: 8
	},
	{
		id: 3,
		user: 'Emma Thompson',
		avatar: 'https://i.pravatar.cc/150?img=3',
		content: 'The color grading in this shot really enhances the mood. Great work!',
		timestamp: '1 day ago',
		likes: 15
	}
];

export function getCommentsByVideoId(_videoId: string): Comment[] {
	return comments;
}
