import { StoryblokBlock } from '@/lib/storyblok';

const Grid = ({ block, editable }) => (
	<div {...editable} className="grid">
		{block.columns?.map((nestedBlock) => (
			<StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
		))}
	</div>
);

export default Grid;
