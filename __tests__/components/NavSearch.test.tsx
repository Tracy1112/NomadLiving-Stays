import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NavSearch from '@/components/navbar/NavSearch'

// Mock Next.js navigation
const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock UI components
jest.mock('@/components/ui/input', () => ({
  Input: function MockInput({ onChange, value, ...props }: any) {
    return (
      <input
        data-testid="search-input"
        onChange={onChange}
        value={value}
        {...props}
      />
    )
  },
}))

describe('NavSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('should render search input with correct placeholder', () => {
    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Find your wilderness escape...')
  })

  it('should initialize with empty value when no search params', () => {
    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    expect(input).toHaveValue('')
  })

  it('should initialize with search param value when present', () => {
    mockSearchParams.set('search', 'beach house')

    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    expect(input).toHaveValue('beach house')
  })

  it('should update input value when user types', async () => {
    const user = userEvent.setup()
    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    await user.type(input, 'mountain cabin')

    expect(input).toHaveValue('mountain cabin')
  })

  it('should call router.replace with search params when user types', async () => {
    const user = userEvent.setup()
    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    await user.type(input, 'beach')

    // Wait for debounced callback
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/?search=beach')
      },
      { timeout: 1000 }
    )
  })

  it('should clear search params when input is empty', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('search', 'beach')

    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    await user.clear(input)

    // Wait for debounced callback
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/?')
      },
      { timeout: 1000 }
    )
  })

  it('should clear input when search params are removed', () => {
    mockSearchParams.set('search', 'beach')
    const { rerender } = render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    expect(input).toHaveValue('beach')

    // Simulate Next.js returning a new searchParams object on navigation
    mockSearchParams = new URLSearchParams()
    rerender(<NavSearch />)

    expect(input).toHaveValue('')
  })

  it('should have correct CSS classes', () => {
    render(<NavSearch />)

    const input = screen.getByTestId('search-input')
    expect(input).toHaveClass('max-w-xs', 'dark:bg-muted')
  })
})
