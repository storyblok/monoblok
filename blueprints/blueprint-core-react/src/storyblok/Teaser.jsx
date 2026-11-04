export default function Teaser({ block, editable }) {
	return (
		<div {...editable} className="teaser">
			<h2>{block.headline}</h2>
		</div>
	);
}
