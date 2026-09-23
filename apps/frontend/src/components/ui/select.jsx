import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './select.css';

/**
 * Determines an automatic badge pill color based on value or label
 */
function getStatusPillClass(val, label) {
  const str = `${val || ''} ${label || ''}`.toLowerCase();
  if (str.includes('active') || str.includes('delivered') || str.includes('ready')) {
    return 'pill-emerald';
  }
  if (
    str.includes('past_due') ||
    str.includes('warning') ||
    str.includes('review') ||
    str.includes('editing')
  ) {
    return 'pill-amber';
  }
  if (
    str.includes('suspended') ||
    str.includes('danger') ||
    str.includes('disabled') ||
    str.includes('retir')
  ) {
    return 'pill-rose';
  }
  if (str.includes('comped') || str.includes('purple')) {
    return 'pill-purple';
  }
  if (str.includes('s3') || str.includes('sftp') || str.includes('ftp')) {
    return 'pill-blue';
  }
  return null;
}

/**
 * Normalizes options from either props.options or React <option> children
 */
function normalizeOptions(options, children) {
  if (Array.isArray(options)) {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      return {
        value: String(opt.value ?? ''),
        label: String(opt.label ?? opt.value ?? ''),
        description: opt.description,
        badge: opt.badge,
        icon: opt.icon,
        disabled: Boolean(opt.disabled),
      };
    });
  }

  if (children) {
    const list = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === 'option') {
        list.push({
          value: String(child.props.value ?? child.props.children ?? ''),
          label: String(child.props.children ?? child.props.value ?? ''),
          disabled: Boolean(child.props.disabled),
        });
      }
    });
    return list;
  }

  return [];
}

/**
 * High-performance, luxury custom Select component inspired by react-select.
 * Features:
 * - Seamless modal/dialog compatibility: renders inside component hierarchy, zero focus-trap conflicts
 * - Instant option selection with onMouseDown to prevent blur-before-click timing race conditions
 * - Dynamic brand styling (hover, focus ring, animated chevron)
 * - Built-in instant search filtering
 * - Status pills & checkmark indicators
 * - Keyboard navigation (Arrows, Enter, Escape)
 * - Auto-placement (opens upward if near bottom of viewport)
 * - 100% drop-in compatibility with <select> props and onChange handlers
 */
export const Select = forwardRef(function Select(
  {
    value: controlledValue,
    defaultValue = '',
    onChange,
    options: rawOptions,
    children,
    placeholder = 'Select an option…',
    searchable,
    isClearable = false,
    disabled = false,
    error = false,
    name,
    id,
    className,
    menuClassName,
    style,
    ...rest
  },
  ref
) {
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [placement, setPlacement] = useState('bottom');

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? String(controlledValue ?? '') : String(internalValue ?? '');

  const normalizedOptions = useMemo(
    () => normalizeOptions(rawOptions, children),
    [rawOptions, children]
  );

  // Auto-enable search if >= 4 options unless explicitly set to false
  const shouldShowSearch =
    searchable !== undefined ? Boolean(searchable) : normalizedOptions.length >= 4;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => opt.value === currentValue),
    [normalizedOptions, currentValue]
  );

  useImperativeHandle(ref, () => ({
    focus: () => triggerRef.current?.focus(),
    blur: () => triggerRef.current?.blur(),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }));

  // Auto-positioning (detect space below trigger)
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const approxMenuHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < approxMenuHeight && spaceAbove > spaceBelow) {
      setPlacement('top');
    } else {
      setPlacement('bottom');
    }
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      if (shouldShowSearch) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 35);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldShowSearch]);

  // Click outside to close (bubble phase so item handlers run first!)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, false);
    return () => document.removeEventListener('mousedown', handleClickOutside, false);
  }, [isOpen]);

  const triggerChange = (newVal) => {
    if (!isControlled) {
      setInternalValue(newVal);
    }
    if (onChange) {
      onChange({
        target: {
          value: newVal,
          name: name || id || '',
        },
      });
    }
  };

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    triggerChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    triggerChange('');
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        break;
      }
      default:
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('.ui-select-item');
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const selectedPill = selectedOption
    ? selectedOption.badge || getStatusPillClass(selectedOption.value, selectedOption.label)
    : null;

  return (
    <div
      ref={containerRef}
      className={twMerge(clsx('ui-select-container', className))}
      style={style}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Hidden native input for form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          id={id ? `${id}-hidden` : undefined}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={clsx(
          'ui-select-trigger',
          isOpen && 'is-open',
          error && 'has-error'
        )}
      >
        <span className="ui-select-value">
          {selectedOption ? (
            <>
              {selectedPill && (
                <span
                  className={clsx(
                    'ui-select-pill',
                    typeof selectedPill === 'string' && selectedPill.startsWith('pill-')
                      ? selectedPill
                      : ''
                  )}
                  style={
                    typeof selectedPill === 'string' && !selectedPill.startsWith('pill-')
                      ? { backgroundColor: selectedPill }
                      : undefined
                  }
                />
              )}
              {selectedOption.icon && <span className="mr-1">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="ui-select-placeholder">{placeholder}</span>
          )}
        </span>

        <span className="ui-select-controls">
          {isClearable && currentValue && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              className="ui-select-clear-btn"
              onClick={handleClear}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className="ui-select-chevron" />
        </span>
      </button>

      {/* Floating Dropdown Menu (rendered within container hierarchy) */}
      {isOpen && (
        <div
          className={twMerge(
            clsx(
              'ui-select-menu',
              placement === 'top' && 'placement-top',
              menuClassName
            )
          )}
          role="listbox"
        >
          {/* Search Bar */}
          {shouldShowSearch && (
            <div
              className="ui-select-search-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <Search size={14} className="ui-select-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  } else if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                    // Pass through to menu navigation
                  } else {
                    e.stopPropagation();
                  }
                }}
                placeholder="Search options…"
                className="ui-select-search-input"
                aria-label="Filter options"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ui-select-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div ref={listRef} className="ui-select-list">
            {filteredOptions.length === 0 ? (
              <div className="ui-select-empty">
                <Search size={18} className="opacity-40" />
                <span>No matching options</span>
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === currentValue;
                const isHighlighted = index === highlightedIndex;
                const optPill =
                  opt.badge || getStatusPillClass(opt.value, opt.label);

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={clsx(
                      'ui-select-item',
                      isSelected && 'is-selected',
                      isHighlighted && 'is-highlighted',
                      opt.disabled && 'is-disabled'
                    )}
                    onMouseEnter={() =>
                      !opt.disabled && setHighlightedIndex(index)
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(opt);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(opt);
                    }}
                  >
                    <div className="ui-select-item-content">
                      {optPill && (
                        <span
                          className={clsx(
                            'ui-select-pill',
                            typeof optPill === 'string' &&
                              optPill.startsWith('pill-')
                              ? optPill
                              : ''
                          )}
                          style={
                            typeof optPill === 'string' &&
                            !optPill.startsWith('pill-')
                              ? { backgroundColor: optPill }
                              : undefined
                          }
                        />
                      )}
                      {opt.icon && <span>{opt.icon}</span>}
                      <div className="ui-select-item-text">
                        <span className="ui-select-item-label">
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="ui-select-item-desc">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={15} className="ui-select-check" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default Select;
