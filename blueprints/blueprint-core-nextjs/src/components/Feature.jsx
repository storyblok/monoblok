const Feature = ({ block, editable }) => {
	return (
		<div className="feature" {...editable}>
			<span>{block.name}</span>
		</div>
	);
};

export default Feature;
