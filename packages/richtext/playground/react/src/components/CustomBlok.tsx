interface CustomBlokProps {
    blok: {
        count: number;
    };
}

const CustomBlok = ({ blok }: CustomBlokProps) => {
    return (
        <div className="flex flex-col items-center gap-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <div className="text-6xl">
        {blok.count}
      </div>
    </div>
    );
}

export default CustomBlok;
