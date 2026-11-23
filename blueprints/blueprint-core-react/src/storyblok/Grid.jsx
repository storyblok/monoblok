import { StoryblokBlock } from '../storyblok';

export default function Grid({ block, editable }) {
	return (
		<div {...editable} className="grid">
			{block.columns?.map((nestedBlock) => (
				<StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
			))}
		</div>
	);
}
