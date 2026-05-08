import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_vault/$itemId_/edit')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$itemId',
      params: { itemId: params.itemId },
      search: { edit: '1' },
    });
  },
});
