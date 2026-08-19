import MinimalHomeV2 from '../home-minimal-v2'

export default function HomePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  return <MinimalHomeV2 searchParams={searchParams} />
}
