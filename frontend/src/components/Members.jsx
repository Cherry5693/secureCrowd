

function Members({ members }) {
    return (
        <aside className="members-panel" style={{ borderLeft: "1px solid #ccc", paddingLeft: "15px", minWidth: "180px" }}>
            <h4>Section Members</h4>
            {members && members.length > 0 ? (
                <ul>
                    {members.map((member, idx) => (
                        <li key={idx}>{member}</li>
                    ))}
                </ul>
            ) : (
                <p>No users in section yet</p>
            )}
        </aside>
    )
}

export default Members;