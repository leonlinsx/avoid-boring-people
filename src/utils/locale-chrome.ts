// Visible UI strings for the discussion island and the newsletter CTA, per
// supported locale. Browser-safe: no Node imports, so the Preact island can
// share it. Only static chrome is translated here — user comments, server
// error messages, subscription behavior, and the Substack form action stay
// exactly as they are.
import { commentErrorMessages } from '../lib/comments/domain.ts';

export interface DiscussionChrome {
  heading: string;
  invitation: string;
  emptyState: string;
  loadingState: string;
  loadFailed: string;
  unavailable: string;
  nameLabel: string;
  namePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  replyToPrefix: string;
  commentFallback: string;
  postButton: string;
  postingButton: string;
  cancelReply: string;
  noticePosted: string;
  noticeUpdated: string;
  noticeDeleted: string;
  authorBadge: string;
  edited: string;
  editLabel: string;
  saveButton: string;
  cancelButton: string;
  replyButton: string;
  editButton: string;
  deleteButton: string;
  deleteConfirm: string;
  confirmDelete: string;
  privatePrefix: string;
  emailLabel: string;
}

const ENGLISH_DISCUSSION: DiscussionChrome = {
  heading: 'Discussion',
  invitation:
    'Thoughtful disagreements, additional evidence, and different ways of looking at the problem are welcome.',
  emptyState: 'No comments yet. Add the first one.',
  loadingState: 'Loading discussion…',
  loadFailed: 'Comments could not be loaded. Refresh the page to try again.',
  unavailable: commentErrorMessages.unavailable,
  nameLabel: 'Display name',
  namePlaceholder: 'Your name or a pseudonym',
  bodyLabel: 'Add to the discussion',
  bodyPlaceholder: 'Add to the discussion…',
  replyToPrefix: 'Reply to',
  commentFallback: 'comment',
  postButton: 'Post',
  postingButton: 'Posting…',
  cancelReply: 'Cancel reply',
  noticePosted: 'Comment posted.',
  noticeUpdated: 'Comment updated.',
  noticeDeleted: 'Comment deleted.',
  authorBadge: 'Author',
  edited: 'edited',
  editLabel: 'Edit comment',
  saveButton: 'Save changes',
  cancelButton: 'Cancel',
  replyButton: 'Reply',
  editButton: 'Edit',
  deleteButton: 'Delete',
  deleteConfirm: 'Delete this comment?',
  confirmDelete: 'Yes, delete',
  privatePrefix: 'Prefer a private conversation?',
  emailLabel: 'Email Leon',
};

const DISCUSSION_BY_LOCALE: Record<string, DiscussionChrome> = {
  ja: {
    heading: 'ディスカッション',
    invitation: '建設的な反論、追加の証拠、異なる見方を歓迎します。',
    emptyState: 'まだコメントはありません。最初のコメントを投稿しましょう。',
    loadingState: 'ディスカッションを読み込んでいます…',
    loadFailed:
      'コメントを読み込めませんでした。ページを更新して再試行してください。',
    unavailable: 'ディスカッションは一時的にご利用いただけません。',
    nameLabel: '表示名',
    namePlaceholder: '名前または仮名',
    bodyLabel: 'ディスカッションに参加する',
    bodyPlaceholder: 'ディスカッションに参加する…',
    replyToPrefix: '返信先',
    commentFallback: 'コメント',
    postButton: '投稿する',
    postingButton: '投稿中…',
    cancelReply: '返信をキャンセル',
    noticePosted: 'コメントを投稿しました。',
    noticeUpdated: 'コメントを更新しました。',
    noticeDeleted: 'コメントを削除しました。',
    authorBadge: '筆者',
    edited: '編集済み',
    editLabel: 'コメントを編集',
    saveButton: '変更を保存',
    cancelButton: 'キャンセル',
    replyButton: '返信',
    editButton: '編集',
    deleteButton: '削除',
    deleteConfirm: 'このコメントを削除しますか？',
    confirmDelete: 'はい、削除します',
    privatePrefix: '非公開での連絡をご希望ですか？',
    emailLabel: 'Leonにメール',
  },
  ko: {
    heading: '토론',
    invitation:
      '사려 깊은 반론, 추가 근거, 문제를 바라보는 다른 시각을 환영합니다.',
    emptyState: '아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.',
    loadingState: '토론을 불러오는 중…',
    loadFailed:
      '댓글을 불러오지 못했습니다. 페이지를 새로고침하고 다시 시도하세요.',
    unavailable: '토론을 일시적으로 이용할 수 없습니다.',
    nameLabel: '표시 이름',
    namePlaceholder: '이름 또는 가명',
    bodyLabel: '토론에 참여하기',
    bodyPlaceholder: '토론에 참여하기…',
    replyToPrefix: '답글 대상',
    commentFallback: '댓글',
    postButton: '게시',
    postingButton: '게시 중…',
    cancelReply: '답글 취소',
    noticePosted: '댓글이 게시되었습니다.',
    noticeUpdated: '댓글이 수정되었습니다.',
    noticeDeleted: '댓글이 삭제되었습니다.',
    authorBadge: '글쓴이',
    edited: '수정됨',
    editLabel: '댓글 수정',
    saveButton: '변경 저장',
    cancelButton: '취소',
    replyButton: '답글',
    editButton: '수정',
    deleteButton: '삭제',
    deleteConfirm: '이 댓글을 삭제할까요?',
    confirmDelete: '예, 삭제합니다',
    privatePrefix: '비공개 대화를 원하시나요?',
    emailLabel: 'Leon에게 이메일 보내기',
  },
  es: {
    heading: 'Discusión',
    invitation:
      'Los desacuerdos razonados, la evidencia adicional y las distintas formas de ver el problema son bienvenidos.',
    emptyState: 'Aún no hay comentarios. Añade el primero.',
    loadingState: 'Cargando la discusión…',
    loadFailed:
      'No se pudieron cargar los comentarios. Actualiza la página e inténtalo de nuevo.',
    unavailable: 'La discusión no está disponible temporalmente.',
    nameLabel: 'Nombre visible',
    namePlaceholder: 'Tu nombre o un seudónimo',
    bodyLabel: 'Participar en la discusión',
    bodyPlaceholder: 'Participa en la discusión…',
    replyToPrefix: 'Responder a',
    commentFallback: 'comentario',
    postButton: 'Publicar',
    postingButton: 'Publicando…',
    cancelReply: 'Cancelar respuesta',
    noticePosted: 'Comentario publicado.',
    noticeUpdated: 'Comentario actualizado.',
    noticeDeleted: 'Comentario eliminado.',
    authorBadge: 'Autor',
    edited: 'editado',
    editLabel: 'Editar comentario',
    saveButton: 'Guardar cambios',
    cancelButton: 'Cancelar',
    replyButton: 'Responder',
    editButton: 'Editar',
    deleteButton: 'Eliminar',
    deleteConfirm: '¿Eliminar este comentario?',
    confirmDelete: 'Sí, eliminar',
    privatePrefix: '¿Prefieres una conversación privada?',
    emailLabel: 'Escribir a Leon',
  },
  'pt-BR': {
    heading: 'Discussão',
    invitation:
      'Discordâncias ponderadas, evidências adicionais e outras formas de ver o problema são bem-vindas.',
    emptyState: 'Ainda não há comentários. Adicione o primeiro.',
    loadingState: 'Carregando a discussão…',
    loadFailed:
      'Não foi possível carregar os comentários. Atualize a página e tente novamente.',
    unavailable: 'A discussão está temporariamente indisponível.',
    nameLabel: 'Nome de exibição',
    namePlaceholder: 'Seu nome ou um pseudônimo',
    bodyLabel: 'Participar da discussão',
    bodyPlaceholder: 'Participe da discussão…',
    replyToPrefix: 'Responder a',
    commentFallback: 'comentário',
    postButton: 'Publicar',
    postingButton: 'Publicando…',
    cancelReply: 'Cancelar resposta',
    noticePosted: 'Comentário publicado.',
    noticeUpdated: 'Comentário atualizado.',
    noticeDeleted: 'Comentário excluído.',
    authorBadge: 'Autor',
    edited: 'editado',
    editLabel: 'Editar comentário',
    saveButton: 'Salvar alterações',
    cancelButton: 'Cancelar',
    replyButton: 'Responder',
    editButton: 'Editar',
    deleteButton: 'Excluir',
    deleteConfirm: 'Excluir este comentário?',
    confirmDelete: 'Sim, excluir',
    privatePrefix: 'Prefere uma conversa privada?',
    emailLabel: 'Enviar e-mail para Leon',
  },
  fr: {
    heading: 'Discussion',
    invitation:
      'Les désaccords réfléchis, les preuves supplémentaires et les autres façons de voir le problème sont les bienvenus.',
    emptyState: 'Aucun commentaire pour le moment. Ajoutez le premier.',
    loadingState: 'Chargement de la discussion…',
    loadFailed:
      'Impossible de charger les commentaires. Actualisez la page et réessayez.',
    unavailable: 'La discussion est temporairement indisponible.',
    nameLabel: 'Nom affiché',
    namePlaceholder: 'Votre nom ou un pseudonyme',
    bodyLabel: 'Participer à la discussion',
    bodyPlaceholder: 'Participez à la discussion…',
    replyToPrefix: 'Répondre à',
    commentFallback: 'commentaire',
    postButton: 'Publier',
    postingButton: 'Publication…',
    cancelReply: 'Annuler la réponse',
    noticePosted: 'Commentaire publié.',
    noticeUpdated: 'Commentaire mis à jour.',
    noticeDeleted: 'Commentaire supprimé.',
    authorBadge: 'Auteur',
    edited: 'modifié',
    editLabel: 'Modifier le commentaire',
    saveButton: 'Enregistrer',
    cancelButton: 'Annuler',
    replyButton: 'Répondre',
    editButton: 'Modifier',
    deleteButton: 'Supprimer',
    deleteConfirm: 'Supprimer ce commentaire ?',
    confirmDelete: 'Oui, supprimer',
    privatePrefix: 'Vous préférez une conversation privée ?',
    emailLabel: 'Écrire à Leon',
  },
  'zh-Hans': {
    heading: '讨论',
    invitation: '欢迎深思熟虑的反驳、补充证据，以及看待问题的不同角度。',
    emptyState: '还没有评论。来发表第一条吧。',
    loadingState: '正在加载讨论…',
    loadFailed: '无法加载评论。请刷新页面后重试。',
    unavailable: '讨论功能暂时不可用。',
    nameLabel: '显示名称',
    namePlaceholder: '您的名字或化名',
    bodyLabel: '参与讨论',
    bodyPlaceholder: '参与讨论…',
    replyToPrefix: '回复',
    commentFallback: '评论',
    postButton: '发布',
    postingButton: '发布中…',
    cancelReply: '取消回复',
    noticePosted: '评论已发布。',
    noticeUpdated: '评论已更新。',
    noticeDeleted: '评论已删除。',
    authorBadge: '作者',
    edited: '已编辑',
    editLabel: '编辑评论',
    saveButton: '保存更改',
    cancelButton: '取消',
    replyButton: '回复',
    editButton: '编辑',
    deleteButton: '删除',
    deleteConfirm: '要删除这条评论吗？',
    confirmDelete: '是，删除',
    privatePrefix: '想要私下交流吗？',
    emailLabel: '给 Leon 发邮件',
  },
};

/** Discussion UI strings; unknown locales fall back to the English UI. */
export function discussionChrome(code?: string): DiscussionChrome {
  if (code && DISCUSSION_BY_LOCALE[code]) return DISCUSSION_BY_LOCALE[code];
  return ENGLISH_DISCUSSION;
}

export interface NewsletterChrome {
  title: string;
  emailLabel: string;
  emailPlaceholder: string;
  subscribeButton: string;
  successFull: string;
  successCompact: string;
}

const ENGLISH_NEWSLETTER: NewsletterChrome = {
  title: 'Get the next essay',
  emailLabel: 'Email address',
  emailPlaceholder: 'Enter your email',
  subscribeButton: 'Subscribe',
  successFull: '✅ Thanks! Check your inbox to confirm.',
  successCompact: '✅ Check inbox!',
};

const NEWSLETTER_BY_LOCALE: Record<string, NewsletterChrome> = {
  ja: {
    title: '次のエッセイを受け取る',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'メールアドレスを入力',
    subscribeButton: '購読する',
    successFull:
      '✅ ありがとうございます！受信トレイを確認して登録を完了してください。',
    successCompact: '✅ 受信トレイを確認！',
  },
  ko: {
    title: '다음 에세이 받기',
    emailLabel: '이메일 주소',
    emailPlaceholder: '이메일을 입력하세요',
    subscribeButton: '구독하기',
    successFull: '✅ 감사합니다! 받은편지함을 확인해 주세요.',
    successCompact: '✅ 받은편지함을 확인하세요!',
  },
  es: {
    title: 'Recibe el próximo ensayo',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'Escribe tu correo',
    subscribeButton: 'Suscribirse',
    successFull: '✅ ¡Gracias! Revisa tu bandeja para confirmar.',
    successCompact: '✅ ¡Revisa tu bandeja!',
  },
  'pt-BR': {
    title: 'Receba o próximo ensaio',
    emailLabel: 'E-mail',
    emailPlaceholder: 'Digite seu e-mail',
    subscribeButton: 'Assinar',
    successFull: '✅ Obrigado! Confira sua caixa de entrada para confirmar.',
    successCompact: '✅ Confira sua caixa de entrada!',
  },
  fr: {
    title: 'Recevez le prochain essai',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'Entrez votre e-mail',
    subscribeButton: "S'abonner",
    successFull: '✅ Merci ! Vérifiez votre boîte mail pour confirmer.',
    successCompact: '✅ Vérifiez votre boîte mail !',
  },
  'zh-Hans': {
    title: '获取下一篇文章',
    emailLabel: '电子邮箱',
    emailPlaceholder: '输入您的邮箱',
    subscribeButton: '订阅',
    successFull: '✅ 谢谢！请查看收件箱以确认订阅。',
    successCompact: '✅ 请查看收件箱！',
  },
};

/** Newsletter CTA copy; unknown locales fall back to the English CTA. */
export function newsletterChrome(code?: string): NewsletterChrome {
  if (code && NEWSLETTER_BY_LOCALE[code]) return NEWSLETTER_BY_LOCALE[code];
  return ENGLISH_NEWSLETTER;
}
