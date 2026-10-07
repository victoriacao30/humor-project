import Window from "@/app/components/Window";

export default function Privacy() {
    return (
        <Window url="www.humorproject.com/privacy" className="narrow">
            <h1 className="label title">Privacy policy:</h1>
            <p>
                This is a class project. When you sign in with Google, we store your
                name, email, and any profile photo you upload. We use this only to run
                the app and never share or sell it. To delete your data, contact the
                site owner.
            </p>
        </Window>
    );
}

