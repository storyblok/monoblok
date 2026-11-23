import { StoryblokBlock } from '@/lib/storyblok';

const Page = ({ block, editable }) => (
	<main {...editable}>
		{block.body?.map((nestedBlock) => (
			<StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
		))}
	</main>
);

export default Page;
