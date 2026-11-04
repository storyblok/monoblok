import { StoryblokBlock } from '../storyblok';

export default function Page({ block, editable }) {
	return (
		<main {...editable}>
			{block.body?.map((nestedBlock, index) => (
				<StoryblokBlock block={nestedBlock} key={nestedBlock._uid || index} />
			))}
		</main>
	);
}
