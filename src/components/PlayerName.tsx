interface PlayerNameProps {
  name: string;
  nickname?: string;
  className?: string;
}

export default function PlayerName({ name, nickname, className }: PlayerNameProps) {
  if (!nickname) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className={className}>
      {name}{' '}
      <span className="italic text-gold">"{nickname}"</span>
    </span>
  );
}
