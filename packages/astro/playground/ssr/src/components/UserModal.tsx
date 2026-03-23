import React from 'react';

// Fake API call to simulate fetching options
const fetchOptions = (): Promise<Array<{ value: string; label: string }>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
        { value: 'three', label: 'Three' },
        { value: 'four', label: 'Four' },
        { value: 'five', label: 'Five' },
      ]);
    }, 2000); // 2 second delay to simulate API call
  });
};

export default function UserModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [openCount, setOpenCount] = React.useState(0);
  const [options, setOptions] = React.useState<Array<{ value: string; label: string }>>([]);
  const [selectedOption, setSelectedOption] = React.useState<{ value: string; label: string } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [fetchCount, setFetchCount] = React.useState(0);
  const [hasFetched, setHasFetched] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch options when dropdown opens for the first time
  React.useEffect(() => {
    if (isOpen && !hasFetched) {
      setIsLoading(true);
      setFetchCount(prev => prev + 1);
      console.log('Fetching options from API...');
      fetchOptions().then((data) => {
        setOptions(data);
        setSelectedOption(data[0]);
        setIsLoading(false);
        setHasFetched(true);
        console.log('Options fetched successfully');
      });
    }
  }, [isOpen, hasFetched]);

  const toggleDropdown = () => {
    if (!isOpen) {
      setOpenCount(prev => prev + 1);
    }
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option: typeof options[0]) => {
    setSelectedOption(option);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        style={{
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
        }}
      >
        <span>{selectedOption?.label || 'Select Option'}</span>
        <span style={{
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
        >
          {openCount}
        </span>
        <span style={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          padding: '2px 6px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold',
        }}
        >
          F:
          {fetchCount}
        </span>
        <span style={{ marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '4px',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            minWidth: '150px',
            zIndex: 1000,
          }}
        >
          {isLoading
            ? (
                <div style={{
                  padding: '20px 16px',
                  textAlign: 'center',
                  color: '#6c757d',
                }}
                >
                  <div style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                  />
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>Loading options...</p>
                </div>
              )
            : (
                options.map(option => (
                  <div
                    key={option.value}
                    onClick={() => handleOptionClick(option)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      backgroundColor: selectedOption?.value === option.value ? '#f0f0f0' : 'transparent',
                      borderBottom: '1px solid #eee',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedOption?.value !== option.value) {
                        e.currentTarget.style.backgroundColor = '#f8f8f8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedOption?.value !== option.value) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {option.label}
                  </div>
                ))
              )}
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
