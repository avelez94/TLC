import PublicPolicyPage, { policyMetadata } from '@/components/PublicPolicyPage'

export const generateMetadata = () => policyMetadata('refund')

export default function Page() {
  return <PublicPolicyPage slug="refund" />
}
