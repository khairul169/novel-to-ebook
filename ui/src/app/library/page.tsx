import { $api, API_URL } from "@/lib/api";

export default function LibraryPage() {
  const { data: books } = $api.useQuery("get", "/library");

  return (
    <div className="min-h-screen bg-zinc-800">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 p-4 gap-4">
        {books?.map((book) => (
          <a
            key={book.key}
            href={`/reader/?book=${encodeURI(book.key)}`}
            className="text-white"
          >
            <div className="w-full aspect-3/4 bg-zinc-700 relative overflow-hidden">
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-md line-clamp-3">
                  {book.metadata?.title || book.name}
                </p>
                <p className="text-sm mt-2 opacity-50">
                  {book.metadata?.creator}
                </p>
              </div>

              <img
                src={`${API_URL}/library/cover.jpeg?key=${book.key}`}
                alt={book.name}
                className="absolute inset-0 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            <div className="truncate mt-1">
              {book.metadata?.title || book.name}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
