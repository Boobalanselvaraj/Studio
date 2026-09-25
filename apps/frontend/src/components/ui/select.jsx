import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './select.css';

/**
 * Determines an automatic badge pill color based on explicit status
 */
function getStatusPillClass(status) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (['active', 'delivered', 'ready', 'success', 'paid'].includes(s)) {
    return 'pill-emerald';
  }
  if (['past_due', 'warning', 'review', 'editing', 'pending'].includes(s)) {
    return 'pill-amber';
  }
  if (['suspended', 'danger', 'disabled', 'failed', 'cancelled'].includes(s)) {
    return 'pill-rose';
  }
  if (['comped', 'purple'].includes(s)) {
    return 'pill-purple';
  }
  if (['s3', 'sftp', 'ftp', 'blue', 'info'].includes(s)) {
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
        status: opt.status,
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
 * - Seamless modal/dialog compatibility: renders via React Portal directly into document.body
 *   with fixed positioning and high z-index, preventing modal clipping and unwanted scrollbars.
 * - Instant option selection with onMouseDown to prevent blur-before-click timing race conditions
 * - Dynamic brand styling (hover, focus ring, animated chevron)
 * - Built-in instant search filtering with perfectly aligned icon & clear button
 * - Status pills & checkmark indicators (only applied when explicitly defined)
 * - Keyboard navigation (Arrows, Enter, Escape)
 * - Dynamic auto-placement (opens upward if near bottom of viewport)
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
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuCoords, setMenuCoords] = useState({
    placement: 'bottom',
    left: 0,
    top: 0,
    bottom: 0,
    width: 0,
    maxHeight: 280,
  });

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? String(controlledValue ?? '') : String(internalValue ?? '');

  const normalizedOptions = useMemo(
    () => normalizeOptions(rawOptions, children),
    [rawOptions, children]
  );

  // Auto-enable search if >= 7 options unless explicitly set
  const shouldShowSearch =
    searchable !== undefined ? Boolean(searchable) : normalizedOptions.length >= 7;

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

  // Position calculation for portal floating dropdown
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // If trigger element has disappeared or scrolled off-screen
    if (rect.width === 0 && rect.height === 0) {
      setIsOpen(false);
      return;
    }

    const approxMenuHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openTop = spaceBelow < approxMenuHeight && spaceAbove > spaceBelow;

    if (openTop) {
      setMenuCoords({
        placement: 'top',
        left: rect.left,
        bottom: window.innerHeight - rect.top + 5,
        width: rect.width,
        maxHeight: Math.min(280, Math.max(120, spaceAbove - 20)),
      });
    } else {
      setMenuCoords({
        placement: 'bottom',
        left: rect.left,
        top: rect.bottom + 5,
        width: rect.width,
        maxHeight: Math.min(280, Math.max(120, spaceBelow - 20)),
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => triggerRef.current?.focus(),
    blur: () => triggerRef.current?.blur(),
    open: () => {
      updatePosition();
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  }));

  // Synchronously compute position on open before paint
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  // Keep dropdown aligned with trigger on window/modal scroll and window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      if (shouldShowSearch) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 40);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldShowSearch]);

  // Click outside to close (handles portal menu element)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

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
        updatePosition();
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
    ? selectedOption.badge || (selectedOption.status ? getStatusPillClass(selectedOption.status) : null)
    : null;

  const menuInlineStyle = {
    position: 'fixed',
    left: `${menuCoords.left}px`,
    width: `${menuCoords.width}px`,
    maxHeight: `${menuCoords.maxHeight}px`,
    zIndex: 99999,
    pointerEvents: 'auto',
    ...(menuCoords.placement === 'top'
      ? { bottom: `${menuCoords.bottom}px` }
      : { top: `${menuCoords.top}px` }),
  };

  const menuContent = isOpen ? (
    <div
      ref={menuRef}
      className={twMerge(
        clsx(
          'ui-select-menu',
          menuCoords.placement === 'top' ? 'placement-top' : 'placement-bottom',
          menuClassName
        )
      )}
      style={menuInlineStyle}
      role="listbox"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
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
                // Pass through to container handleKeyDown
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
              opt.badge || (opt.status ? getStatusPillClass(opt.status) : null);

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
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
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
  ) : null;

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
        onClick={toggleOpen}
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

      {/* Floating Dropdown Menu rendered via Portal so it never clips or scrolls parents */}
      {typeof document !== 'undefined' && menuContent
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
});

export default Select;
