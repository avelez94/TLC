import PublicPolicyPage, { policyMetadata } from '@/components/PublicPolicyPage'

export const generateMetadata = () => policyMetadata('terms')

export default function Page() {
  return <PublicPolicyPage slug="terms" />
}
