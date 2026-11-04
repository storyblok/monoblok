export default function Feature({ block, editable }) {
	return (
		<div {...editable} className="feature">
			<span>{block.name}</span>
		</div>
	);
}
